-- =========================================================================
--  LanorTrad — Missions hebdomadaires.
--  À COLLER dans : Supabase → SQL Editor → New query → Run.
--  Idempotent. Nécessite gamification.sql (xp_events, check_achievements…).
--  Voir GAMIFICATION-SETUP.md.
--
--  3 missions/semaine, choisies par ROTATION déterministe (n° de semaine ISO) :
--  toujours 1 Lecture + 1 Communauté + 1 Découverte/Assiduité. Chaque mission
--  réussie et réclamée = +50 XP. Les 3 la même semaine = « Semaine parfaite » +50.
--  La progression se lit depuis xp_events (aucun compteur à maintenir).
-- =========================================================================

-- État d'une mission pour un membre : métadonnées + progression + réclamée ?
-- Réservée au serveur (appelée par weekly_missions / claim_mission).
create or replace function public.mission_state(p_uid uuid, p_key text, p_wk timestamptz, p_wkref text)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  v_label text; v_cat text; v_target int; v_prog int := 0; v_claimed boolean := false;
begin
  select l, c, t into v_label, v_cat, v_target from (values
    ('read_5',        'Lis 5 chapitres cette semaine',           'Lecture',     5),
    ('read_10',       'Lis 10 chapitres cette semaine',          'Lecture',    10),
    ('comment_2',     'Poste 2 commentaires de chapitre',        'Communauté',  2),
    ('forum_1',       'Ouvre un sujet ou réponds sur le forum',  'Communauté',  1),
    ('read_series_3', 'Lis un chapitre de 3 séries différentes', 'Découverte',  3),
    ('active_5',      'Connecte-toi 5 jours cette semaine',      'Assiduité',   5)
  ) as m(k, l, c, t) where k = p_key;
  if v_label is null then return null; end if;

  if p_uid is not null then
    v_prog := case p_key
      when 'read_5'        then (select count(*) from public.xp_events where user_id = p_uid and kind = 'read'    and created_at >= p_wk)
      when 'read_10'       then (select count(*) from public.xp_events where user_id = p_uid and kind = 'read'    and created_at >= p_wk)
      when 'comment_2'     then (select count(*) from public.xp_events where user_id = p_uid and kind = 'comment' and created_at >= p_wk)
      when 'forum_1'       then (select count(*) from public.xp_events where user_id = p_uid and kind = 'forum'   and created_at >= p_wk)
      when 'read_series_3' then (select count(distinct split_part(ref, ':', 1)) from public.xp_events where user_id = p_uid and kind = 'read' and created_at >= p_wk)
      when 'active_5'      then (select count(distinct (created_at at time zone 'Europe/Paris')::date) from public.xp_events where user_id = p_uid and created_at >= p_wk)
      else 0 end;
    v_claimed := exists(select 1 from public.xp_events
      where user_id = p_uid and kind = 'mission' and ref = p_key || ':' || p_wkref);
  end if;

  return jsonb_build_object(
    'key', p_key, 'label', v_label, 'category', v_cat,
    'target', v_target, 'progress', least(v_prog, v_target),
    'done', v_prog >= v_target, 'claimed', v_claimed);
end; $$;

-- Les 3 clés de la semaine (rotation par n° de semaine ISO).
create or replace function public.weekly_mission_keys(p_wknum int)
returns text[] language sql immutable as $$
  select array[
    (array['read_5','read_10'])[1 + (p_wknum % 2)],
    (array['comment_2','forum_1'])[1 + (p_wknum % 2)],
    (array['read_series_3','active_5'])[1 + (p_wknum % 2)]
  ];
$$;

-- Les missions de la semaine + progression du membre connecté (ou 0 si anon).
create or replace function public.weekly_missions()
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  uid   uuid := auth.uid();
  wk    timestamptz := date_trunc('week', (now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris';
  wkref text := to_char((now() at time zone 'Europe/Paris'), 'IYYY-IW');
  wknum int  := extract(week from (now() at time zone 'Europe/Paris'))::int;
  res   jsonb := '[]'::jsonb;
  k     text;
begin
  foreach k in array weekly_mission_keys(wknum) loop
    res := res || jsonb_build_array(mission_state(uid, k, wk, wkref));
  end loop;
  return jsonb_build_object('ok', true, 'week', wkref, 'missions', res);
end; $$;

-- Réclamer la récompense d'une mission terminée (+50, idempotent/semaine).
create or replace function public.claim_mission(p_key text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid      uuid := auth.uid();
  wk       timestamptz := date_trunc('week', (now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris';
  wkref    text := to_char((now() at time zone 'Europe/Paris'), 'IYYY-IW');
  wknum    int  := extract(week from (now() at time zone 'Europe/Paris'))::int;
  st       jsonb;
  nclaimed int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  -- La mission doit appartenir au set de CETTE semaine (anti-triche).
  if not (p_key = any(weekly_mission_keys(wknum))) then
    return jsonb_build_object('ok', false, 'error', 'not_active');
  end if;

  st := mission_state(uid, p_key, wk, wkref);
  if not (st->>'done')::boolean then
    return jsonb_build_object('ok', false, 'error', 'not_done', 'state', st);
  end if;

  insert into public.xp_events (user_id, kind, ref, xp)
    values (uid, 'mission', p_key || ':' || wkref, 50)
    on conflict (user_id, kind, ref) do nothing;
  if not found then return jsonb_build_object('ok', true, 'already', true); end if;
  update public.profiles set xp = xp + 50 where id = uid;

  -- Semaine parfaite : les 3 missions réclamées → +50 (idempotent).
  select count(*) into nclaimed from public.xp_events
   where user_id = uid and kind = 'mission'
     and ref like '%:' || wkref and ref not like 'perfect:%';
  if nclaimed >= 3 then
    insert into public.xp_events (user_id, kind, ref, xp)
      values (uid, 'mission', 'perfect:' || wkref, 50)
      on conflict (user_id, kind, ref) do nothing;
    if found then update public.profiles set xp = xp + 50 where id = uid; end if;
  end if;

  perform public.check_achievements(uid);
  return jsonb_build_object('ok', true, 'awarded', 50, 'perfect', nclaimed >= 3);
end; $$;

grant execute on function public.weekly_missions()          to anon, authenticated;
grant execute on function public.claim_mission(text)        to authenticated;
revoke execute on function public.mission_state(uuid, text, timestamptz, text) from public, anon, authenticated;
