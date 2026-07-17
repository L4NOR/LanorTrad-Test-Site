-- =========================================================================
--  LanorTrad — Quiz de la semaine.
--  À COLLER dans Supabase → SQL Editor → New query → Run.
--  Idempotent. Nécessite gamification.sql (xp_events, profiles.xp,
--  check_achievements).
--
--  5 questions/semaine, tirées du pool par rotation déterministe (md5 de
--  l'id + n° de semaine ISO). Une tentative par membre et par semaine :
--  +10 XP par bonne réponse, +25 de bonus si sans-faute (75 max).
--  Les réponses vivent UNIQUEMENT côté serveur (RLS sans policy) ; le
--  client reçoit les questions sans la solution, et la correction après
--  sa tentative.
--
--  ➕ AJOUTER DES QUESTIONS : Table Editor → quiz_questions → Insert row
--  (question, options = tableau de 2 à 4 choix, answer = index de la bonne
--  réponse en partant de 1, active = true). Elles entrent d'office dans
--  la rotation. Dans le seed ci-dessous la bonne réponse est toujours la
--  1re option (answer = 1) : pas grave, le site MÉLANGE l'ordre d'affichage.
-- =========================================================================

create table if not exists public.quiz_questions (
  id         bigint generated always as identity primary key,
  question   text not null check (char_length(question) between 5 and 200),
  options    text[] not null check (array_length(options, 1) between 2 and 4),
  answer     int not null check (answer >= 1),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  week       text not null,                    -- 'IYYY-IW'
  score      int  not null,
  total      int  not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week)
);

alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts  enable row level security;
-- Aucune policy : accès uniquement via les fonctions SECURITY DEFINER
-- (la colonne `answer` ne doit JAMAIS être lisible du client).

-- ----------------------------------------------------------------------
--  Seed (uniquement si le pool est vide — ré-exécutable sans doublon).
--  Faits tirés du site : fiches séries, crédits de fin de chapitre, règles XP.
-- ----------------------------------------------------------------------
insert into public.quiz_questions (question, options, answer)
select * from (values
  ('Qui dessine et écrit Tougen Anki ?',
    array['Yura Urushibara','Kazue Katô','Uru Okabe','Kanata Yanagawa'], 1),
  ('Dans Tougen Anki, quel sang coule dans les veines de Shiki Ichinose ?',
    array['Celui des Oni','Celui des exorcistes','Celui des spectres','Celui de Momotarô'], 1),
  ('Dans Tougen Anki, les Oni affrontent les descendants de…',
    array['Momotarô','Satan','les Enfers de Tokyo','l''Académie de la Croix-Vraie'], 1),
  ('Qui est l''autrice de Ao No Exorcist ?',
    array['Kazue Katô','Yura Urushibara','Hironori Yamatani','Uru Okabe'], 1),
  ('Dans Ao No Exorcist, Rin Okumura est le fils de…',
    array['Satan','Momotarô','un Oni','un chevalier exorciste'], 1),
  ('Quelles flammes Rin Okumura cherche-t-il à dompter ?',
    array['Des flammes bleues','Des flammes noires','Des flammes d''or','Des flammes blanches'], 1),
  ('Quel sport fait vibrer Catenaccio ?',
    array['Le football','Le basket','Le baseball','Le cyclisme'], 1),
  ('Avec quelles teams traduit-on Catenaccio main dans la main ?',
    array['KaminaTrad & Flexxon','SoloScan & Nakama','OniTrad & Kurofan','Personne, on est seuls dessus'], 1),
  ('Dans Catenaccio, combien d''années Yataro Araki se donne-t-il pour atteindre le sommet européen ?',
    array['Dix ans','Cinq ans','Trois ans','Vingt ans'], 1),
  ('Dans Tokyo Underworld, où tombent les coupables selon la légende urbaine ?',
    array['Dans les Enfers de Tokyo','Dans la baie de Tokyo','Dans un manoir hanté','Dans une prison secrète'], 1),
  ('Dans Satsudou, de quoi rêve Mitsuo Akamori ?',
    array['D''une vie de salarié banal','De devenir le meilleur assassin','D''ouvrir un dojo','De faire le tour du monde'], 1),
  ('Lequel de ces titres du catalogue est un oneshot ?',
    array['Countdown','Satsudou','Catenaccio','Tokyo Underworld'], 1),
  ('Qui s''occupe de la traduction dans la team ?',
    array['Taichoskii','Lanor','Zerox','KaminaTrad'], 1),
  ('Qui fait le clean et l''edit des chapitres ?',
    array['Lanor','Taichoskii','Zerox','Flexxon'], 1),
  ('Qui assure le contrôle qualité (QC) avant publication ?',
    array['Zerox','Lanor','Taichoskii','Personne, on publie direct'], 1),
  ('Quel est le rang « Aura » le plus élevé du site ?',
    array['Astre Lanor','Aurore','Brasier','Flamme'], 1),
  ('Par quel rang « Aura » commence chaque lecteur ?',
    array['Étincelle','Lueur','Flamme','Braise'], 1),
  ('Combien d''XP rapporte un chapitre terminé ?',
    array['20','5','50','100'], 1),
  ('Quel jour les missions de la semaine se renouvellent-elles ?',
    array['Le lundi','Le vendredi','Le samedi','Le 1er du mois'], 1)
) as seed(q, o, a)
where not exists (select 1 from public.quiz_questions);

-- ----------------------------------------------------------------------
--  Les 5 questions de la semaine (rotation déterministe par semaine ISO).
--  Fonction interne, révoquée du client.
-- ----------------------------------------------------------------------
create or replace function public.quiz_week_ids(p_wkref text)
returns bigint[] language sql stable as $$
  select coalesce(array_agg(id), '{}') from (
    select id from public.quiz_questions where active
    order by md5(id::text || p_wkref) limit 5
  ) t;
$$;

-- Le quiz de la semaine : questions SANS la solution + ma tentative éventuelle.
create or replace function public.weekly_quiz()
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  uid   uuid := auth.uid();
  wkref text := to_char((now() at time zone 'Europe/Paris'), 'IYYY-IW');
  ids   bigint[] := public.quiz_week_ids(wkref);
  qs    jsonb;
  att   jsonb;
begin
  if coalesce(array_length(ids, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_questions');
  end if;
  select jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'options', q.options)
                   order by array_position(ids, q.id))
    into qs from public.quiz_questions q where q.id = any(ids);
  if uid is not null then
    select jsonb_build_object('score', a.score, 'total', a.total) into att
      from public.quiz_attempts a where a.user_id = uid and a.week = wkref;
  end if;
  return jsonb_build_object('ok', true, 'week', wkref, 'taken', att, 'questions', qs);
end; $$;

-- Répondre au quiz (une fois par semaine). p_answers = objet {"<id>": choix}.
-- Renvoie le score, l'XP gagné et la correction (pour l'affichage après coup).
create or replace function public.answer_quiz(p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  wkref  text := to_char((now() at time zone 'Europe/Paris'), 'IYYY-IW');
  ids    bigint[] := public.quiz_week_ids(wkref);
  q      record;
  choice int;
  score  int := 0;
  total  int := coalesce(array_length(ids, 1), 0);
  gained int;
  corr   jsonb := '{}'::jsonb;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if total = 0 then return jsonb_build_object('ok', false, 'error', 'no_questions'); end if;
  if exists (select 1 from public.quiz_attempts where user_id = uid and week = wkref) then
    return jsonb_build_object('ok', false, 'error', 'already_taken');
  end if;

  for q in select id, answer from public.quiz_questions where id = any(ids) loop
    choice := case when (p_answers ->> q.id::text) ~ '^[0-9]{1,2}$'
                   then (p_answers ->> q.id::text)::int else null end;
    if choice = q.answer then score := score + 1; end if;
    corr := corr || jsonb_build_object(q.id::text, q.answer);
  end loop;

  gained := score * 10 + case when score = total then 25 else 0 end;
  insert into public.quiz_attempts (user_id, week, score, total) values (uid, wkref, score, total);
  if gained > 0 then
    insert into public.xp_events (user_id, kind, ref, xp) values (uid, 'quiz', wkref, gained)
      on conflict (user_id, kind, ref) do nothing;
    if found then
      update public.profiles set xp = xp + gained where id = uid;
      perform public.check_achievements(uid);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'score', score, 'total', total,
                            'xp', gained, 'correction', corr);
end; $$;

grant execute on function public.weekly_quiz()       to anon, authenticated;
grant execute on function public.answer_quiz(jsonb)  to authenticated;
revoke execute on function public.quiz_week_ids(text) from public, anon, authenticated;
