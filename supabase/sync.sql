-- =========================================================================
--  LanorTrad — Synchronisation multi-appareils (progression + suivis).
--  À COLLER dans : Supabase → SQL Editor → New query → Run. Idempotent.
--  Indépendant du reste (seule l'auth Supabase est requise). Chaque membre
--  ne voit et ne modifie QUE ses propres lignes (RLS), accès PostgREST direct.
-- =========================================================================

create table if not exists public.reading_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  manga_id   text not null,
  chapter    text not null,
  page       integer not null default 0,
  t          bigint not null default 0,   -- horodatage client (ms) : « le plus récent gagne »
  updated_at timestamptz not null default now(),
  primary key (user_id, manga_id)
);

alter table public.reading_progress enable row level security;

drop policy if exists reading_progress_own on public.reading_progress;
create policy reading_progress_own on public.reading_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Suivis : UNE ligne par membre avec la liste complète — ainsi les
-- désabonnements se propagent aussi (une fusion par union ne le permet pas).
create table if not exists public.user_follows (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  follows    jsonb not null default '[]',
  t          bigint not null default 0,   -- horodatage client (ms) du dernier changement
  updated_at timestamptz not null default now()
);

alter table public.user_follows enable row level security;

drop policy if exists user_follows_own on public.user_follows;
create policy user_follows_own on public.user_follows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
