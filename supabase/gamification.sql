-- =========================================================================
--  LanorTrad — Gamification : XP, niveaux, streak, succès (Supabase/PostgreSQL)
--  À COLLER dans : Supabase → SQL Editor → New query → Run.
--  Idempotent : ré-exécutable sans danger. Nécessite schema.sql (forum/comptes).
--  Voir GAMIFICATION-SETUP.md.
-- =========================================================================

-- ----------------------------------------------------------------------
--  1. COLONNES DE GAMIFICATION SUR profiles
-- ----------------------------------------------------------------------
alter table public.profiles add column if not exists xp                   int     not null default 0;
alter table public.profiles add column if not exists streak               int     not null default 0;
alter table public.profiles add column if not exists streak_best          int     not null default 0;
alter table public.profiles add column if not exists last_active          date;
alter table public.profiles add column if not exists streak_freeze_week   date;   -- semaine (lundi) où le gel a été consommé
alter table public.profiles add column if not exists leaderboard_opt_out  boolean not null default false;
alter table public.profiles add column if not exists equipped             jsonb   not null default '{}'::jsonb;
alter table public.profiles add column if not exists reads_count          int     not null default 0;
alter table public.profiles add column if not exists comments_count       int     not null default 0;
alter table public.profiles add column if not exists forum_count          int     not null default 0;
alter table public.profiles add column if not exists reactions_count      int     not null default 0;

-- Empêche toute écriture DIRECTE de l'XP / du streak par le client (sinon le
-- règlement RLS profiles_update_own laisserait un membre se fixer 99999 XP).
-- Seule la fonction award_xp (SECURITY DEFINER, exécutée en tant que
-- propriétaire) peut modifier ces colonnes. Le reste du profil (bio, avatar,
-- equipped, opt-out) reste modifiable par le membre.
revoke update (xp, streak, streak_best, last_active, streak_freeze_week,
               reads_count, comments_count, forum_count, reactions_count)
  on public.profiles from anon, authenticated;

-- ----------------------------------------------------------------------
--  2. NIVEAU À PARTIR DE L'XP
--  Courbe : XP cumulé pour atteindre le niveau N = 20 · N · (N−1).
--  Inversion : N = floor( (1 + sqrt(1 + xp/5)) / 2 ), plancher à 1.
-- ----------------------------------------------------------------------
create or replace function public.level_from_xp(p_xp int)
returns int language sql immutable as $$
  select greatest(1, floor((1 + sqrt(1 + greatest(p_xp,0)::numeric / 5)) / 2)::int);
$$;

-- ----------------------------------------------------------------------
--  3. JOURNAL DES GAINS D'XP  (idempotent par (user, kind, ref))
--  kind : 'read' | 'comment' | 'forum' | 'reaction' | 'series_complete'
--         | 'streak' | 'mission' | 'achievement'
--  ref  : identifiant unique de la source (ex 'Tougen Anki:167', une date…)
-- ----------------------------------------------------------------------
create table if not exists public.xp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  ref        text not null default '',
  xp         int  not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index if not exists xp_events_user_time_idx on public.xp_events(user_id, created_at desc);
create index if not exists xp_events_time_idx      on public.xp_events(created_at desc);      -- classement hebdo
create index if not exists xp_events_read_idx      on public.xp_events(user_id) where kind = 'read';

-- ----------------------------------------------------------------------
--  4. SUCCÈS (définitions + obtentions)
-- ----------------------------------------------------------------------
create table if not exists public.achievements (
  key         text primary key,
  name        text not null,
  description text not null,
  icon        text,                         -- nom d'icône Tabler (ex 'book')
  xp          int  not null default 0,
  secret      boolean not null default false,
  position    int  not null default 0
);

create table if not exists public.user_achievements (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  key       text not null references public.achievements(key) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ----------------------------------------------------------------------
--  5. FONCTION D'ATTRIBUTION  (le client ne choisit JAMAIS le montant)
--  Retour JSON : { ok, awarded, xp, level, leveled_up, streak, duplicate }
-- ----------------------------------------------------------------------
create or replace function public.award_xp(p_kind text, p_ref text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_today     date := (now() at time zone 'Europe/Paris')::date;
  v_week      date := date_trunc('week', v_today::timestamp)::date;   -- lundi
  v_base      int;
  v_cap       int;
  v_daily     int;
  v_xp        int;
  v_prof      public.profiles;
  v_old_level int;
  v_new_level int;
  v_streak_bonus int := 0;
  v_new_streak int;
  v_first_today boolean := false;
  v_ach text[];
  v_n text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  -- Barème serveur + plafond journalier (en XP) par type
  select b, c into v_base, v_cap from (values
    ('read',            20,  600),
    ('comment',          5,   25),
    ('forum',           10,   30),
    ('reaction',         2,   20),
    ('series_complete',100,1000000)
  ) as t(k, b, c) where k = p_kind;

  if v_base is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_kind');
  end if;

  -- Plafond du jour : on rabote le montant si le plafond est déjà atteint
  select coalesce(sum(xp), 0) into v_daily
    from public.xp_events
   where user_id = v_uid and kind = p_kind
     and (created_at at time zone 'Europe/Paris')::date = v_today;
  v_xp := least(v_base, greatest(0, v_cap - v_daily));

  -- Idempotence : (kind, ref) ne compte qu'une fois. On enregistre l'événement
  -- même si v_xp = 0 (ex : chapitre relu / plafond atteint) pour ne jamais le
  -- re-créditer un autre jour.
  begin
    insert into public.xp_events (user_id, kind, ref, xp)
    values (v_uid, p_kind, coalesce(p_ref, ''), v_xp);
  exception when unique_violation then
    select * into v_prof from public.profiles where id = v_uid;
    return jsonb_build_object('ok', true, 'awarded', 0, 'duplicate', true,
      'xp', v_prof.xp, 'level', level_from_xp(v_prof.xp), 'streak', v_prof.streak);
  end;

  select * into v_prof from public.profiles where id = v_uid;
  v_old_level := level_from_xp(v_prof.xp);

  -- Streak : mis à jour à la 1re activité de la journée (tout type confondu)
  if v_prof.last_active is distinct from v_today then
    v_first_today := true;
    if v_prof.last_active is null then
      v_new_streak := 1;
    elsif v_prof.last_active = v_today - 1 then
      v_new_streak := v_prof.streak + 1;
    elsif v_prof.last_active = v_today - 2
          and coalesce(v_prof.streak_freeze_week, date '1900-01-01') < v_week then
      v_new_streak := v_prof.streak + 1;                 -- gel : 1 jour manqué toléré/semaine
      update public.profiles set streak_freeze_week = v_week where id = v_uid;
    else
      v_new_streak := 1;                                 -- série cassée
    end if;

    -- Bonus de streak (fixe, escaladé) — 1×/jour via l'idempotence sur la date
    v_streak_bonus := case
      when v_new_streak >= 30 then 75
      when v_new_streak >= 7  then 40
      when v_new_streak >= 3  then 20
      else 10 end;
    insert into public.xp_events (user_id, kind, ref, xp)
    values (v_uid, 'streak', v_today::text, v_streak_bonus)
    on conflict (user_id, kind, ref) do nothing;

    update public.profiles
       set streak = v_new_streak,
           streak_best = greatest(streak_best, v_new_streak),
           last_active = v_today
     where id = v_uid;
  else
    v_new_streak := v_prof.streak;
  end if;

  -- Crédit total (gain de l'action + bonus de streak) + compteurs par type
  update public.profiles
     set xp = xp + v_xp + v_streak_bonus,
         reads_count    = reads_count    + (case when p_kind = 'read'    then 1 else 0 end),
         comments_count = comments_count + (case when p_kind = 'comment' then 1 else 0 end),
         forum_count    = forum_count    + (case when p_kind = 'forum'   then 1 else 0 end)
   where id = v_uid;

  -- Succès automatiques (seuils) + succès secret « oiseau de nuit » (2 h–5 h)
  v_ach := check_achievements(v_uid);
  if p_kind = 'read'
     and extract(hour from (now() at time zone 'Europe/Paris')) between 2 and 4 then
    v_n := grant_achievement(v_uid, 'night_owl');
    if v_n is not null then v_ach := array_append(v_ach, v_n); end if;
  end if;

  select * into v_prof from public.profiles where id = v_uid;   -- inclut l'XP des succès
  v_new_level := level_from_xp(v_prof.xp);

  return jsonb_build_object(
    'ok', true,
    'awarded', v_xp + v_streak_bonus,
    'xp', v_prof.xp,
    'level', v_new_level,
    'leveled_up', v_new_level > v_old_level,
    'streak', v_new_streak,
    'streak_bonus', case when v_first_today then v_streak_bonus else 0 end,
    'new_achievements', to_jsonb(v_ach),
    'duplicate', false
  );
end; $$;

grant execute on function public.award_xp(text, text) to authenticated;

-- ----------------------------------------------------------------------
--  5b. SUCCÈS AUTOMATIQUES
--  grant_achievement  : attribue un succès (idempotent) + crédite son XP.
--                       Retourne le NOM si nouvellement obtenu, sinon NULL.
--  check_achievements : passe en revue les seuils et attribue ce qui est dû.
--                       Retourne les noms nouvellement obtenus (toast client).
--  Ces deux fonctions ne sont appelées QUE côté serveur (award_xp / trigger) :
--  on RÉVOQUE l'accès direct client pour empêcher tout auto-octroi.
-- ----------------------------------------------------------------------
create or replace function public.grant_achievement(p_uid uuid, p_key text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_xp int; v_name text;
begin
  select xp, name into v_xp, v_name from public.achievements where key = p_key;
  if v_name is null then return null; end if;
  insert into public.user_achievements (user_id, key) values (p_uid, p_key)
    on conflict (user_id, key) do nothing;
  if not found then return null; end if;                 -- déjà obtenu
  insert into public.xp_events (user_id, kind, ref, xp)
    values (p_uid, 'achievement', p_key, coalesce(v_xp, 0))
    on conflict (user_id, kind, ref) do nothing;
  update public.profiles set xp = xp + coalesce(v_xp, 0) where id = p_uid;
  return v_name;
end; $$;

create or replace function public.check_achievements(p_uid uuid)
returns text[]
language plpgsql security definer set search_path = public as $$
declare r public.profiles; v_level int; v_new text[] := '{}'; v_n text;
begin
  select * into r from public.profiles where id = p_uid;
  if not found then return v_new; end if;
  v_level := level_from_xp(r.xp);

  v_n := case when r.reads_count     >= 1    then grant_achievement(p_uid, 'first_chapter') end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when r.reads_count     >= 100  then grant_achievement(p_uid, 'read_100')      end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when r.reads_count     >= 500  then grant_achievement(p_uid, 'read_500')      end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when r.reads_count     >= 1000 then grant_achievement(p_uid, 'read_1000')     end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when r.streak          >= 7    then grant_achievement(p_uid, 'streak_7')      end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when r.streak          >= 30   then grant_achievement(p_uid, 'streak_30')     end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when r.streak          >= 365  then grant_achievement(p_uid, 'streak_365')    end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when r.comments_count  >= 1    then grant_achievement(p_uid, 'first_comment') end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when r.forum_count     >= 50   then grant_achievement(p_uid, 'forum_50')      end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when r.reactions_count >= 100  then grant_achievement(p_uid, 'reactions_100') end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when v_level           >= 10   then grant_achievement(p_uid, 'rank_flamme')   end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when v_level           >= 20   then grant_achievement(p_uid, 'rank_brasier')  end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when v_level           >= 30   then grant_achievement(p_uid, 'rank_aurore')   end; if v_n is not null then v_new := v_new || v_n; end if;
  v_n := case when v_level           >= 50   then grant_achievement(p_uid, 'rank_astre')    end; if v_n is not null then v_new := v_new || v_n; end if;
  return v_new;
end; $$;

revoke execute on function public.grant_achievement(uuid, text) from public, anon, authenticated;
revoke execute on function public.check_achievements(uuid)       from public, anon, authenticated;

-- ----------------------------------------------------------------------
--  6. RLS
-- ----------------------------------------------------------------------
alter table public.xp_events         enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;

-- xp_events : chacun lit les SIENS ; aucune écriture directe (passe par award_xp) ;
-- staff peut tout lire. (Les agrégats du classement passeront par une vue/fonction
-- SECURITY DEFINER dédiée — tranche 4 — pour ne pas exposer le détail des events.)
drop policy if exists xp_events_read_own on public.xp_events;
drop policy if exists xp_events_staff    on public.xp_events;
create policy xp_events_read_own on public.xp_events for select using (auth.uid() = user_id);
create policy xp_events_staff    on public.xp_events for all
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- achievements : catalogue public en lecture ; écriture staff.
drop policy if exists achievements_read  on public.achievements;
drop policy if exists achievements_staff on public.achievements;
create policy achievements_read  on public.achievements for select using (true);
create policy achievements_staff on public.achievements for all
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- user_achievements : lecture publique (vitrine profil) ; écriture par fonction only.
drop policy if exists user_achievements_read on public.user_achievements;
create policy user_achievements_read on public.user_achievements for select using (true);

-- ----------------------------------------------------------------------
--  7. CATALOGUE DE SUCCÈS DE DÉPART  (modifiable ensuite)
-- ----------------------------------------------------------------------
insert into public.achievements (key, name, description, icon, xp, secret, position) values
  ('first_chapter', 'Première étincelle', 'Lire ton tout premier chapitre',            'sparkles',      10, false, 10),
  ('read_100',      'Dévoreur',           'Lire 100 chapitres',                         'book',         100, false, 20),
  ('read_500',      'Rat de bibliothèque','Lire 500 chapitres',                         'books',        250, false, 30),
  ('read_1000',     'Marathonien',        'Lire 1000 chapitres',                        'run',          500, false, 40),
  ('library_full',  'Bibliothèque complète','Lire au moins un chapitre de chaque série','building-store',200,false, 50),
  ('streak_7',      'Fidèle',             '7 jours de série',                           'flame',         30, false, 60),
  ('streak_30',     'Inébranlable',       '30 jours de série',                          'flame',        150, false, 70),
  ('streak_365',    'Un an de lumière',   '365 jours de série',                         'sun',         1000, false, 80),
  ('first_comment', 'Première voix',      'Poster ton premier commentaire',             'message',       10, false, 90),
  ('forum_50',      'Pilier du forum',    'Poster 50 messages sur le forum',            'messages',     100, false,100),
  ('reactions_100', 'Populaire',          'Recevoir 100 réactions',                     'heart',        100, false,110),
  ('series_1',      'Complétionniste',    'Rattraper une série entière',                'circle-check',  50, false,120),
  ('early_10',      'Aux premières loges','Lire 10 sorties dans les 48 h',              'clock',        150, false,130),
  ('night_owl',     'Oiseau de nuit',     'Lire entre 2 h et 5 h du matin',             'moon',          25, true, 200),
  ('marathon_2h',   'Marathon',           'Lire pendant 2 h d''affilée',                'player-play',   50, true, 210),
  ('rank_flamme',   'Flamme',             'Atteindre le rang Flamme (niv. 10)',         'flame',          0, false,300),
  ('rank_brasier',  'Brasier',            'Atteindre le rang Brasier (niv. 20)',        'flame',          0, false,310),
  ('rank_aurore',   'Aurore',             'Atteindre le rang Aurore (niv. 30)',         'sunrise',        0, false,320),
  ('rank_astre',    'Astre Lanor',        'Atteindre le rang Astre (niv. 50)',          'star',           0, false,330)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  xp = excluded.xp, secret = excluded.secret, position = excluded.position;

-- ----------------------------------------------------------------------
--  8. RATTRAPAGE des données existantes : compteurs + succès rétroactifs
-- ----------------------------------------------------------------------
update public.profiles p set
  reads_count    = coalesce((select count(*) from public.xp_events e where e.user_id = p.id and e.kind = 'read'), 0),
  comments_count = coalesce((select count(*) from public.xp_events e where e.user_id = p.id and e.kind = 'comment'), 0),
  forum_count    = coalesce((select count(*) from public.xp_events e where e.user_id = p.id and e.kind = 'forum'), 0);

do $$ declare r record; begin
  for r in select id from public.profiles loop perform public.check_achievements(r.id); end loop;
end $$;

-- =========================================================================
--  NOTE : l'XP des RÉACTIONS reçues (déclencheur sur public.reactions) vit
--  dans supabase/gamification-triggers.sql (dépend du forum + des réactions).
--  Les MISSIONS hebdomadaires arrivent ensuite.
-- =========================================================================
