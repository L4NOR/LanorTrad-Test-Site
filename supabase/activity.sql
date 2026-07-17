-- =========================================================================
--  LanorTrad — Fil « En ce moment » de l'accueil.
--  À COLLER dans Supabase → SQL Editor → New query → Run.
--  Idempotent. À exécuter APRÈS schema.sql, reader-comments.sql et
--  gamification.sql : le fil agrège leurs tables.
--
--  Une seule RPC publique qui agrège l'activité récente et publique du
--  site : derniers commentaires de chapitre, nouveaux sujets du forum,
--  succès fraîchement débloqués (jamais les secrets), nouveaux membres.
--  Uniquement des infos déjà publiques ailleurs (forum, profils).
-- =========================================================================

create or replace function public.recent_activity(p_limit int default 8)
returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object('ok', true, 'items',
    coalesce(jsonb_agg(to_jsonb(u) order by u.at desc), '[]'::jsonb))
  from (
    select * from (
      (select 'comment'::text as type, p.username, c.manga_id as ref,
              c.chapter_num as ref2, c.created_at as at
         from public.chapter_comments c
         join public.profiles p on p.id = c.author_id
        order by c.created_at desc limit 6)
      union all
      (select 'topic', p.username, t.title, t.id::text, t.created_at
         from public.topics t
         join public.profiles p on p.id = t.author_id
        order by t.created_at desc limit 6)
      union all
      (select 'achievement', p.username, a.name, null::text, ua.earned_at
         from public.user_achievements ua
         join public.achievements a on a.key = ua.key and not a.secret
         join public.profiles p on p.id = ua.user_id
        order by ua.earned_at desc limit 6)
      union all
      (select 'member', p.username, null::text, null::text, p.created_at
         from public.profiles p
        order by p.created_at desc limit 4)
    ) x
    order by at desc
    limit greatest(1, least(coalesce(p_limit, 8), 20))
  ) u;
$$;

grant execute on function public.recent_activity(int) to anon, authenticated;
