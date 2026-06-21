-- =========================================================================
--  LanorTrad — Commentaires par chapitre (lecteur)
--  À COLLER dans Supabase → SQL Editor → New query → Run (APRÈS schema.sql).
--  Réutilise les comptes du forum (table profiles). Idempotent.
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
