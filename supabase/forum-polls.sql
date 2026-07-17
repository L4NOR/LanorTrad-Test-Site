-- =========================================================================
--  LanorTrad — Sondages du forum (un sondage optionnel par sujet).
--  À COLLER dans Supabase → SQL Editor → New query → Run
--  (APRÈS schema.sql). Idempotent.
--  Tout passe par les RPC (create_poll / vote_poll / poll_for_topic) :
--  les tables restent fermées (RLS sans policy). Un membre = un vote,
--  modifiable ; re-cliquer son choix = retirer son vote. Votes anonymes
--  (l'agrégat est public, qui a voté quoi ne l'est pas).
-- =========================================================================

create table if not exists public.polls (
  id         bigint generated always as identity primary key,
  topic_id   bigint not null unique references public.topics(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id       bigint generated always as identity primary key,
  poll_id  bigint not null references public.polls(id) on delete cascade,
  label    text not null check (char_length(label) between 1 and 80),
  position int  not null default 0
);
create index if not exists poll_options_poll_idx on public.poll_options(poll_id);

create table if not exists public.poll_votes (
  poll_id    bigint not null references public.polls(id) on delete cascade,
  option_id  bigint not null references public.poll_options(id) on delete cascade,
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes   enable row level security;
-- Aucune policy : accès uniquement via les fonctions SECURITY DEFINER.

-- Créer le sondage d'un sujet (réservé à l'auteur du sujet, 2 à 6 options).
create or replace function public.create_poll(p_topic bigint, p_options text[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  pid  bigint;
  opt  text;
  i    int := 0;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if not exists (select 1 from public.topics where id = p_topic and author_id = uid) then
    return jsonb_build_object('ok', false, 'error', 'not_author');
  end if;
  if p_options is null or array_length(p_options, 1) < 2 or array_length(p_options, 1) > 6 then
    return jsonb_build_object('ok', false, 'error', 'bad_options');
  end if;

  insert into public.polls (topic_id) values (p_topic)
    on conflict (topic_id) do nothing
    returning id into pid;
  if pid is null then return jsonb_build_object('ok', false, 'error', 'already_exists'); end if;

  foreach opt in array p_options loop
    opt := trim(opt);
    if char_length(opt) between 1 and 80 then
      i := i + 1;
      insert into public.poll_options (poll_id, label, position) values (pid, opt, i);
    end if;
  end loop;
  if i < 2 then
    delete from public.polls where id = pid;
    return jsonb_build_object('ok', false, 'error', 'bad_options');
  end if;
  return jsonb_build_object('ok', true, 'poll_id', pid);
end; $$;

-- Le sondage d'un sujet : options + décomptes + mon vote (null si anonyme).
create or replace function public.poll_for_topic(p_topic bigint)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  pid  bigint;
  opts jsonb;
  tot  int;
  mine bigint;
begin
  select id into pid from public.polls where topic_id = p_topic;
  if pid is null then return jsonb_build_object('ok', true, 'poll', null); end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'votes', o.n) order by o.position), '[]'::jsonb),
         coalesce(sum(o.n), 0)::int
    into opts, tot
    from (select po.id, po.label, po.position, count(pv.user_id)::int as n
            from public.poll_options po
            left join public.poll_votes pv on pv.option_id = po.id
           where po.poll_id = pid group by po.id) o;

  if auth.uid() is not null then
    select option_id into mine from public.poll_votes
     where poll_id = pid and user_id = auth.uid();
  end if;

  return jsonb_build_object('ok', true, 'poll',
    jsonb_build_object('id', pid, 'options', opts, 'total', tot, 'mine', mine));
end; $$;

-- Voter / changer de vote / retirer (re-clic sur son choix). Renvoie le
-- sondage à jour. Refusé si le sujet est verrouillé.
create or replace function public.vote_poll(p_option bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  pid    bigint;
  tid    bigint;
  cur    bigint;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select po.poll_id, p.topic_id into pid, tid
    from public.poll_options po join public.polls p on p.id = po.poll_id
   where po.id = p_option;
  if pid is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if exists (select 1 from public.topics where id = tid and locked) then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  select option_id into cur from public.poll_votes where poll_id = pid and user_id = uid;
  if cur = p_option then
    delete from public.poll_votes where poll_id = pid and user_id = uid;
  else
    insert into public.poll_votes (poll_id, option_id, user_id)
      values (pid, p_option, uid)
      on conflict (poll_id, user_id)
      do update set option_id = excluded.option_id, created_at = now();
  end if;
  return public.poll_for_topic(tid);
end; $$;

grant execute on function public.create_poll(bigint, text[]) to authenticated;
grant execute on function public.poll_for_topic(bigint)      to anon, authenticated;
grant execute on function public.vote_poll(bigint)           to authenticated;
