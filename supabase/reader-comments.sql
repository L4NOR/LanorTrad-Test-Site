-- =========================================================================
--  LanorTrad — Commentaires par chapitre (lecteur)
--  À COLLER dans Supabase → SQL Editor → New query → Run
--  (APRÈS schema.sql ET forum-reactions-notifications.sql).
--  Réutilise les comptes du forum (profiles) + le système de notifications.
--  Idempotent.
-- =========================================================================

create table if not exists public.chapter_comments (
  id          bigint generated always as identity primary key,
  manga_id    text not null,                 -- = id de la série (dossier /Manga)
  chapter_num text not null,                 -- = numéro de chapitre ("19", "138.5"…)
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 5000),
  created_at  timestamptz not null default now()
);
create index if not exists chapter_comments_idx
  on public.chapter_comments(manga_id, chapter_num, created_at);

alter table public.chapter_comments enable row level security;

drop policy if exists chcom_read        on public.chapter_comments;
drop policy if exists chcom_insert_self on public.chapter_comments;
drop policy if exists chcom_update_own  on public.chapter_comments;
drop policy if exists chcom_delete_own  on public.chapter_comments;
drop policy if exists chcom_staff       on public.chapter_comments;

create policy chcom_read        on public.chapter_comments for select using (true);
create policy chcom_insert_self on public.chapter_comments for insert with check (auth.uid() = author_id);
create policy chcom_update_own  on public.chapter_comments for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy chcom_delete_own  on public.chapter_comments for delete using (auth.uid() = author_id);
create policy chcom_staff       on public.chapter_comments for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------
--  MENTIONS @pseudo dans les commentaires de chapitre → notifications
--  (réutilise la table notifications + extract_mentions de
--   forum-reactions-notifications.sql)
-- ----------------------------------------------------------------------
-- Colonnes "lecteur" sur les notifications (pour pointer vers un chapitre)
alter table public.notifications add column if not exists manga_id    text;
alter table public.notifications add column if not exists chapter_num text;
alter table public.notifications add column if not exists comment_id  bigint references public.chapter_comments(id) on delete cascade;

create or replace function public.notify_on_chapter_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare mname text; muid uuid;
begin
  for mname in select * from public.extract_mentions(new.body) loop
    select id into muid from public.profiles where lower(username) = mname limit 1;
    if muid is not null and muid <> new.author_id then
      insert into public.notifications (user_id, actor_id, type, manga_id, chapter_num, comment_id)
      values (muid, new.author_id, 'mention', new.manga_id, new.chapter_num, new.id);
    end if;
  end loop;
  return new;
end; $$;

drop trigger if exists trg_notify_chapter_comment on public.chapter_comments;
create trigger trg_notify_chapter_comment after insert on public.chapter_comments
  for each row execute function public.notify_on_chapter_comment();
