-- =========================================================================
--  LanorTrad — Classement (leaderboard) : hebdomadaire + rang perso.
--  À COLLER dans : Supabase → SQL Editor → New query → Run.
--  Idempotent. Nécessite gamification.sql (xp_events, level_from_xp, colonnes).
--  Voir GAMIFICATION-SETUP.md.
--
--  NB : le classement ALL-TIME ne nécessite aucune fonction — il se lit
--  directement depuis public.profiles (lecture publique via RLS). Seul le
--  HEBDO a besoin d'agréger les xp_events (RLS = lecture own only), d'où ces
--  fonctions SECURITY DEFINER qui n'exposent que des agrégats publics.
-- =========================================================================

-- Début de la semaine courante (lundi 00:00, Europe/Paris) en timestamptz.
create or replace function public.week_start_paris()
returns timestamptz language sql stable as $$
  select date_trunc('week', (now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris';
$$;

-- Classement HEBDOMADAIRE : somme de l'XP gagné depuis lundi, par membre.
-- N'expose QUE : pseudo, avatar, XP de la semaine, niveau (dérivé de l'XP total).
create or replace function public.leaderboard_weekly(p_limit int default 25)
returns table(rnk bigint, id uuid, username text, avatar_url text, xp int, lvl int)
language sql security definer set search_path = public stable as $$
  with wk as (
    select e.user_id, sum(e.xp)::int as xpw
      from public.xp_events e
     where e.created_at >= public.week_start_paris()
     group by e.user_id
  )
  select row_number() over (order by w.xpw desc, p.username),
         p.id, p.username, p.avatar_url, w.xpw, public.level_from_xp(p.xp)
    from wk w
    join public.profiles p on p.id = w.user_id
   where w.xpw > 0 and not p.leaderboard_opt_out
   order by w.xpw desc, p.username
   limit greatest(1, least(p_limit, 100));
$$;

-- Rang perso du membre connecté (hebdo + all-time), même hors du top affiché.
create or replace function public.my_rank()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  uid uuid := auth.uid();
  wk_self int; wk_rank int; at_xp int; at_rank int;
begin
  if uid is null then return jsonb_build_object('ok', false); end if;

  -- Hebdo : mon XP de la semaine + combien de membres (non opt-out) me devancent.
  select coalesce(sum(xp), 0)::int into wk_self
    from public.xp_events
   where user_id = uid and created_at >= public.week_start_paris();
  select count(*) + 1 into wk_rank from (
    select e.user_id
      from public.xp_events e
      join public.profiles p on p.id = e.user_id
     where e.created_at >= public.week_start_paris() and not p.leaderboard_opt_out
     group by e.user_id
     having sum(e.xp) > wk_self
  ) t;

  -- All-time : depuis profiles.xp.
  select xp into at_xp from public.profiles where id = uid;
  select count(*) + 1 into at_rank
    from public.profiles
   where not leaderboard_opt_out and xp > coalesce(at_xp, 0);

  return jsonb_build_object('ok', true,
    'week_xp', wk_self, 'week_rank', wk_rank,
    'alltime_xp', coalesce(at_xp, 0), 'alltime_rank', at_rank);
end; $$;

grant execute on function public.week_start_paris()      to anon, authenticated;
grant execute on function public.leaderboard_weekly(int) to anon, authenticated;
grant execute on function public.my_rank()               to authenticated;
