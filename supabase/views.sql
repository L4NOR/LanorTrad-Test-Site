-- =========================================================================
--  LanorTrad — Compteurs de lectures par série (preuve sociale + tendances).
--  À COLLER dans : Supabase → SQL Editor → New query → Run. Idempotent.
--  Indépendant du reste (ne nécessite que schema.sql pour la fonction is_staff,
--  optionnelle ici). Compté même pour les visiteurs anonymes.
-- =========================================================================

create table if not exists public.series_views (
  manga_id   text primary key,
  views      bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.series_views enable row level security;

-- Lecture publique (afficher « X lectures ») ; aucune écriture directe (RPC only).
drop policy if exists series_views_read on public.series_views;
create policy series_views_read on public.series_views for select using (true);

-- Incrémente le compteur d'une série (upsert). La déduplication (1 vue/jour/
-- navigateur) est faite côté client — ici on ne fait qu'ajouter.
create or replace function public.bump_view(p_manga text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_manga is null or p_manga = '' then return; end if;
  insert into public.series_views (manga_id, views, updated_at)
    values (p_manga, 1, now())
  on conflict (manga_id) do update
    set views = public.series_views.views + 1, updated_at = now();
end; $$;

grant execute on function public.bump_view(text) to anon, authenticated;
