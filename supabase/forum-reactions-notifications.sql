-- =========================================================================
--  LanorTrad — Forum : Réactions + Notifications + Mentions
--  À COLLER dans Supabase → SQL Editor → New query → Run (APRÈS schema.sql).
--  Idempotent : ré-exécutable sans danger.
-- =========================================================================

-- ----------------------------------------------------------------------
--  RÉACTIONS  (👍 ❤️ … sur un sujet (OP) ou une réponse)
-- ----------------------------------------------------------------------
create table if not exists public.reactions (
  id          bigint generated always as identity primary key,
  target_kind text   not null check (target_kind in ('topic', 'post')),
  target_id   bigint not null,
  user_id     uuid   not null references public.profiles(id) on delete cascade,
  emoji       text   not null,
  created_at  timestamptz not null default now(),
  unique (target_kind, target_id, user_id, emoji)
);
create index if not exists reactions_target_idx on public.reactions(target_kind, target_id);

alter table public.reactions enable row level security;
drop policy if exists reactions_read        on public.reactions;
drop policy if exists reactions_insert_self on public.reactions;
drop policy if exists reactions_delete_self on public.reactions;
create policy reactions_read        on public.reactions for select using (true);
create policy reactions_insert_self on public.reactions for insert with check (auth.uid() = user_id);
create policy reactions_delete_self on public.reactions for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------
--  NOTIFICATIONS  (réponse à ton sujet, mention @pseudo)
--  Seuls les triggers SECURITY DEFINER insèrent (les users ne peuvent pas
--  forger de notifications) → aucune policy INSERT.
-- ----------------------------------------------------------------------
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,  -- destinataire
  actor_id   uuid references public.profiles(id) on delete set null,          -- déclencheur
  type       text not null,                                                   -- 'reply' | 'mention'
  topic_id   bigint references public.topics(id) on delete cascade,
  post_id    bigint references public.posts(id)  on delete cascade,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists notifications_read_own   on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_read_own   on public.notifications for select using (auth.uid() = user_id);
create policy notifications_update_own on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notifications_delete_own on public.notifications for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------
--  MENTIONS  : extrait les @pseudo d'un texte (renvoie des pseudos en minuscule)
-- ----------------------------------------------------------------------
create or replace function public.extract_mentions(body text)
returns setof text language sql immutable as $$
  select distinct lower(m[1])
  from regexp_matches(coalesce(body, ''), '@([[:alnum:]_]{3,24})', 'g') as m;
$$;

-- ----------------------------------------------------------------------
--  TRIGGERS de notification
-- ----------------------------------------------------------------------
-- Nouvelle réponse → notifier l'auteur du sujet + les mentionnés
create or replace function public.notify_on_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare t_author uuid; mname text; muid uuid;
begin
  select author_id into t_author from public.topics where id = new.topic_id;

  if t_author is not null and t_author <> new.author_id then
    insert into public.notifications (user_id, actor_id, type, topic_id, post_id)
    values (t_author, new.author_id, 'reply', new.topic_id, new.id);
  end if;

  for mname in select * from public.extract_mentions(new.body) loop
    select id into muid from public.profiles where lower(username) = mname limit 1;
    if muid is not null and muid <> new.author_id
       and (t_author is null or muid <> t_author) then
      insert into public.notifications (user_id, actor_id, type, topic_id, post_id)
      values (muid, new.author_id, 'mention', new.topic_id, new.id);
    end if;
  end loop;
  return new;
end; $$;

drop trigger if exists trg_notify_post on public.posts;
create trigger trg_notify_post after insert on public.posts
  for each row execute function public.notify_on_post();

-- Nouveau sujet → notifier les mentionnés dans le message d'origine
create or replace function public.notify_on_topic()
returns trigger language plpgsql security definer set search_path = public as $$
declare mname text; muid uuid;
begin
  for mname in select * from public.extract_mentions(new.body) loop
    select id into muid from public.profiles where lower(username) = mname limit 1;
    if muid is not null and muid <> new.author_id then
      insert into public.notifications (user_id, actor_id, type, topic_id)
      values (muid, new.author_id, 'mention', new.id);
    end if;
  end loop;
  return new;
end; $$;

drop trigger if exists trg_notify_topic on public.topics;
create trigger trg_notify_topic after insert on public.topics
  for each row execute function public.notify_on_topic();
