-- =========================================================================
--  LanorTrad — Podium de la semaine passée (flair « couronne »).
--  À COLLER dans Supabase → SQL Editor → New query → Run.
--  Idempotent. Nécessite gamification.sql + leaderboard.sql
--  (week_start_paris). Le top 3 hebdo de la semaine PRÉCÉDENTE porte une
--  couronne 👑 la semaine suivante (classement + profil forum) : du
--  prestige gagnable chaque semaine, même sans être Astre.
-- =========================================================================

create or replace function public.podium_last_week()
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object('ok', true, 'names',
    coalesce(jsonb_agg(t.username order by t.wxp desc), '[]'::jsonb))
  from (
    select p.username, sum(e.xp)::int as wxp
      from public.xp_events e
      join public.profiles p on p.id = e.user_id
     where e.created_at >= public.week_start_paris() - interval '7 days'
       and e.created_at <  public.week_start_paris()
       and not p.leaderboard_opt_out
     group by p.username
     having sum(e.xp) > 0
     order by wxp desc
     limit 3
  ) t;
$$;

grant execute on function public.podium_last_week() to anon, authenticated;
