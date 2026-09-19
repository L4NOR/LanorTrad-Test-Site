-- =========================================================================
--  LanorTrad — Pronostics de chapitre.
--  À COLLER dans Supabase → SQL Editor → New query → Run. Idempotent.
--  Nécessite schema.sql (profiles, is_staff) et gamification.sql
--  (xp_events, profiles.xp, check_achievements).
--
--  La team pose une question sur un chapitre à venir (« Qui remporte le
--  combat ? »), 2 à 4 réponses. Les membres votent, un vote chacun,
--  modifiable tant que les votes sont ouverts. À la sortie, la team donne la
--  bonne réponse : chaque bon pronostic rapporte +30 XP (une fois par
--  pronostic, compté dans le classement de la semaine).
--
--  Tout passe par des fonctions : les tables n'ont AUCUNE policy. La bonne
--  réponse n'existe pas avant d'être donnée, et les votes restent anonymes
--  (seuls les totaux sortent).
--
--  CÔTÉ TEAM : tout se fait depuis le site (page Classement, connecté avec un
--  compte admin ou modo) : créer, clore les votes, donner la réponse,
--  supprimer. Rien à faire dans le Table Editor.
-- =========================================================================

create table if not exists public.predictions (
  id          bigint generated always as identity primary key,
  manga_id    text not null check (char_length(manga_id) between 1 and 80),
  chapter     text not null check (char_length(chapter) between 1 and 12),   -- le chapitre qui tranchera
  question    text not null check (char_length(question) between 5 and 200),
  options     text[] not null check (array_length(options, 1) between 2 and 4),
  answer      int check (answer >= 1),                    -- null tant que non tranché
  closes_at   timestamptz,                                -- null = ouvert jusqu'à la clôture
  closed      boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists predictions_manga_idx on public.predictions (manga_id, created_at desc);

create table if not exists public.prediction_votes (
  prediction_id bigint not null references public.predictions (id) on delete cascade,
  user_id       uuid   not null references public.profiles (id) on delete cascade,
  choice        int    not null check (choice >= 1),
  created_at    timestamptz not null default now(),
  primary key (prediction_id, user_id)
);

alter table public.predictions      enable row level security;
alter table public.prediction_votes enable row level security;
-- Aucune policy : accès uniquement par les fonctions ci-dessous.

-- ----------------------------------------------------------------------
--  Vue publique d'un pronostic (fonction interne) : totaux par réponse,
--  mon vote, et la bonne réponse seulement une fois donnée.
-- ----------------------------------------------------------------------
create or replace function public.prediction_json(p public.predictions, p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'manga', p.manga_id, 'chapter', p.chapter,
    'question', p.question, 'options', p.options,
    'closes_at', p.closes_at, 'created_at', p.created_at, 'resolved_at', p.resolved_at,
    'answer', p.answer,
    'status', case when p.answer is not null then 'resolved'
                   when p.closed or (p.closes_at is not null and p.closes_at <= now()) then 'closed'
                   else 'open' end,
    'counts', (select coalesce(jsonb_object_agg(choice::text, n), '{}'::jsonb)
                 from (select choice, count(*) n from public.prediction_votes
                        where prediction_id = p.id group by choice) c),
    'total', (select count(*) from public.prediction_votes where prediction_id = p.id),
    'mine', (select choice from public.prediction_votes where prediction_id = p.id and user_id = p_uid)
  );
$$;

-- Liste : les pronostics ouverts, et ceux tranchés depuis moins de 30 jours
-- (le temps de voir qui avait raison). p_manga filtre sur une série.
create or replace function public.predictions_list(p_manga text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  return jsonb_build_object('ok', true,
    'staff', coalesce(public.is_staff(uid), false),
    'items', coalesce((
      select jsonb_agg(public.prediction_json(p, uid) order by (p.answer is not null), p.created_at desc)
        from public.predictions p
       where (p_manga is null or p.manga_id = p_manga)
         and (p.answer is null or p.resolved_at > now() - interval '30 days')
    ), '[]'::jsonb));
end; $$;

-- Voter (ou changer d'avis) tant que c'est ouvert.
create or replace function public.vote_prediction(p_id bigint, p_choice int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.predictions;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select * into p from public.predictions where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p.answer is not null or p.closed or (p.closes_at is not null and p.closes_at <= now()) then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if p_choice is null or p_choice < 1 or p_choice > array_length(p.options, 1) then
    return jsonb_build_object('ok', false, 'error', 'bad_choice');
  end if;
  insert into public.prediction_votes (prediction_id, user_id, choice) values (p_id, uid, p_choice)
    on conflict (prediction_id, user_id) do update set choice = excluded.choice, created_at = now();
  return jsonb_build_object('ok', true, 'item', public.prediction_json(p, uid));
end; $$;

-- ----------------------------------------------------------------------
--  Côté team (admin / modo uniquement)
-- ----------------------------------------------------------------------
create or replace function public.create_prediction(p_manga text, p_chapter text, p_question text,
                                                    p_options text[], p_closes_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); opts text[]; new_id bigint;
begin
  if not coalesce(public.is_staff(uid), false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  -- Réponses nettoyées : sans vides, sans espaces autour, 80 caractères max.
  select coalesce(array_agg(left(btrim(o), 80) order by i), '{}') into opts
    from unnest(p_options) with ordinality as t(o, i) where btrim(coalesce(o, '')) <> '';
  if coalesce(array_length(opts, 1), 0) not between 2 and 4 then
    return jsonb_build_object('ok', false, 'error', 'bad_options');
  end if;
  insert into public.predictions (manga_id, chapter, question, options, closes_at, created_by)
  values (btrim(p_manga), btrim(p_chapter), btrim(p_question), opts, p_closes_at, uid)
  returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id);
exception when check_violation then
  return jsonb_build_object('ok', false, 'error', 'invalid');
end; $$;

create or replace function public.close_prediction(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_staff(auth.uid()), false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  update public.predictions set closed = true where id = p_id;
  return jsonb_build_object('ok', found);
end; $$;

-- Donner la bonne réponse : clôt le pronostic et crédite les bons votes.
-- Une seule fois : on ne change pas la réponse après coup (l'XP est parti).
create or replace function public.resolve_prediction(p_id bigint, p_answer int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.predictions; w record; n int := 0;
begin
  if not coalesce(public.is_staff(auth.uid()), false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select * into p from public.predictions where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p.answer is not null then return jsonb_build_object('ok', false, 'error', 'already_resolved'); end if;
  if p_answer is null or p_answer < 1 or p_answer > array_length(p.options, 1) then
    return jsonb_build_object('ok', false, 'error', 'bad_choice');
  end if;

  update public.predictions set answer = p_answer, closed = true, resolved_at = now() where id = p_id;

  for w in select user_id from public.prediction_votes where prediction_id = p_id and choice = p_answer loop
    insert into public.xp_events (user_id, kind, ref, xp) values (w.user_id, 'prono', p_id::text, 30)
      on conflict (user_id, kind, ref) do nothing;
    if found then
      update public.profiles set xp = xp + 30 where id = w.user_id;
      perform public.check_achievements(w.user_id);
      n := n + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'winners', n);
end; $$;

create or replace function public.delete_prediction(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_staff(auth.uid()), false) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  -- Un pronostic déjà tranché a distribué de l'XP : on le garde, pour que
  -- le journal xp_events continue de renvoyer à quelque chose.
  delete from public.predictions where id = p_id and answer is null;
  return jsonb_build_object('ok', found);
end; $$;

grant execute on function public.predictions_list(text)          to anon, authenticated;
grant execute on function public.vote_prediction(bigint, int)    to authenticated;
grant execute on function public.create_prediction(text, text, text, text[], timestamptz) to authenticated;
grant execute on function public.close_prediction(bigint)        to authenticated;
grant execute on function public.resolve_prediction(bigint, int) to authenticated;
grant execute on function public.delete_prediction(bigint)       to authenticated;
revoke execute on function public.prediction_json(public.predictions, uuid) from public, anon, authenticated;
