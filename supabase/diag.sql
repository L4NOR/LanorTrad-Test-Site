-- =========================================================================
--  LanorTrad — Diagnostic : « quels scripts SQL sont réellement déployés ? »
--  À COLLER dans Supabase → SQL Editor → New query → Run. Idempotent.
--
--  POURQUOI CE FICHIER
--  La page diag.html sait déjà répondre toute seule, en interrogeant l'API :
--  si une table répond, c'est qu'elle existe. Mais deux choses lui échappent :
--    • un TRIGGER — il ne s'expose pas par l'API ;
--    • une fonction dont l'accès client est volontairement fermé — l'API
--      répond « inconnue », exactement comme si elle n'existait pas.
--  C'est le cas de gamification-triggers.sql, qui n'est fait que de ça.
--
--  lt_diag() répond donc depuis l'intérieur de la base. La page l'utilise
--  quand elle existe, et retombe sinon sur ses propres sondes.
--
--  CE QUE ÇA EXPOSE
--  Uniquement des oui/non sur des noms d'objets écrits en dur ci-dessous.
--  Aucune donnée, aucune liste de tables, rien d'autre que ce que le site
--  laisse déjà deviner (une fonctionnalité s'affiche ou ne s'affiche pas).
--  C'est aussi pour ça que la liste est FIGÉE ici plutôt que lue dans le
--  catalogue système : une fonction de diagnostic ne doit pas devenir un
--  moyen commode d'explorer le schéma.
-- =========================================================================

create or replace function public.lt_diag()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'schema.sql',
      (to_regclass('public.profiles') is not null
       and to_regclass('public.topics') is not null
       and to_regclass('public.posts') is not null),

    'forum-profile-fields.sql',
      exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'profiles'
                 and column_name = 'fav_genres'),

    'forum-reactions-notifications.sql',
      (to_regclass('public.reactions') is not null
       and to_regclass('public.notifications') is not null
       and exists (select 1 from pg_trigger where tgname = 'trg_notify_post' and not tgisinternal)),

    'reader-comments.sql',
      to_regclass('public.chapter_comments') is not null,

    'storage-avatars.sql',
      exists (select 1 from storage.buckets where id = 'avatars'),

    'gamification.sql',
      (to_regclass('public.xp_events') is not null
       and to_regclass('public.achievements') is not null
       and to_regprocedure('public.award_xp(text, text)') is not null),

    -- La mise à jour du même script (compteurs + succès automatiques).
    -- Séparée : la base peut porter la première version.
    'gamification.sql:maj',
      (exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'profiles'
                  and column_name = 'reads_count')
       and to_regprocedure('public.check_achievements(uuid)') is not null),

    -- Le cas qui justifie ce fichier : fonction fermée au client + trigger.
    'gamification-triggers.sql',
      (to_regprocedure('public.award_reaction_xp(uuid, text)') is not null
       and exists (select 1 from pg_trigger where tgname = 'trg_reaction_xp' and not tgisinternal)),

    'leaderboard.sql',
      to_regprocedure('public.leaderboard_weekly(int)') is not null,

    'missions.sql',
      to_regprocedure('public.weekly_missions()') is not null,

    'cosmetics.sql',
      (to_regclass('public.cosmetics') is not null
       and to_regprocedure('public.set_cosmetic(text)') is not null),

    'views.sql',
      (to_regclass('public.series_views') is not null
       and to_regprocedure('public.bump_view(text)') is not null),

    'ratings.sql',
      (to_regclass('public.series_rating_stats') is not null
       and to_regprocedure('public.rate_series(text, int)') is not null),

    'sync.sql',
      (to_regclass('public.reading_progress') is not null
       and to_regclass('public.user_follows') is not null),

    'chapter-mood.sql',
      (to_regclass('public.chapter_moods') is not null
       and to_regprocedure('public.set_chapter_mood(text, text, text)') is not null),

    'forum-polls.sql',
      (to_regclass('public.polls') is not null
       and to_regprocedure('public.vote_poll(bigint)') is not null),

    'quiz.sql',
      (to_regclass('public.quiz_questions') is not null
       and to_regprocedure('public.answer_quiz(jsonb)') is not null),

    'activity.sql',
      to_regprocedure('public.recent_activity(int)') is not null,

    'podium.sql',
      to_regprocedure('public.podium_last_week()') is not null,

    'presence.sql',
      (to_regclass('public.presence') is not null
       and to_regprocedure('public.presence_ping(text, text)') is not null)
  );
$$;

revoke all on function public.lt_diag() from public;
grant execute on function public.lt_diag() to anon, authenticated;

-- Vérification : doit renvoyer un objet JSON de oui/non.
--   select public.lt_diag();
