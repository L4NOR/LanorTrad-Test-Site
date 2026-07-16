-- =========================================================================
--  LanorTrad — Notes des lecteurs (1 à 5 étoiles) par série.
--  À COLLER dans : Supabase → SQL Editor → New query → Run. Idempotent.
--  Indépendant du reste (seule l'auth Supabase est requise pour noter).
--  Anonymes : lecture des moyennes uniquement ; noter demande un compte.
-- =========================================================================

create table if not exists public.series_ratings (
  manga_id   text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (manga_id, user_id)
);

alter table public.series_ratings enable row level security;

-- Chacun ne lit QUE sa propre note (les moyennes passent par la vue publique
-- ci-dessous). Aucune écriture directe : tout passe par la RPC rate_series.
drop policy if exists series_ratings_read_own on public.series_ratings;
create policy series_ratings_read_own on public.series_ratings
  for select using (auth.uid() = user_id);

-- Moyennes publiques. La vue s'exécute avec les droits de son propriétaire
-- (bypass RLS) : c'est voulu — elle n'expose que des agrégats (score arrondi
-- + nombre de votes), aucune donnée personnelle.
create or replace view public.series_rating_stats as
  select manga_id,
         round(avg(rating)::numeric, 2)::float as score,
         count(*)::int as votes
    from public.series_ratings
   group by manga_id;

grant select on public.series_rating_stats to anon, authenticated;

-- Poser ou changer SA note (upsert). Renvoie les nouveaux agrégats pour une
-- mise à jour immédiate côté client.
create or replace function public.rate_series(p_manga text, p_rating int)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_score float;
  v_votes int;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'auth');
  end if;
  if p_manga is null or p_manga = '' or length(p_manga) > 64 then
    return json_build_object('ok', false, 'error', 'manga');
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return json_build_object('ok', false, 'error', 'rating');
  end if;

  insert into public.series_ratings (manga_id, user_id, rating, updated_at)
    values (p_manga, v_uid, p_rating, now())
  on conflict (manga_id, user_id) do update
    set rating = excluded.rating, updated_at = now();

  select round(avg(rating)::numeric, 2)::float, count(*)::int
    into v_score, v_votes
    from public.series_ratings
   where manga_id = p_manga;

  return json_build_object('ok', true, 'rating', p_rating, 'score', v_score, 'votes', v_votes);
end; $$;

revoke all on function public.rate_series(text, int) from public;
grant execute on function public.rate_series(text, int) to authenticated;
