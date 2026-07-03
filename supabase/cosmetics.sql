-- =========================================================================
--  LanorTrad — Cosmétiques débloqués par rang (couleur de pseudo, cadre d'avatar).
--  À COLLER dans : Supabase → SQL Editor → New query → Run.
--  Idempotent. Nécessite gamification.sql (profiles.equipped, level_from_xp).
--
--  Principe : purement esthétique (aucun avantage). Chaque cosmétique a un
--  niveau minimum ; set_cosmetic() VALIDE le rang côté serveur avant d'équiper.
--  On révoque l'écriture directe de profiles.equipped pour forcer ce passage.
-- =========================================================================

-- Catalogue (lecture publique). id = '<kind-court>:<clé>' ; css = classe appliquée.
create table if not exists public.cosmetics (
  id        text primary key,
  kind      text not null,          -- 'name_color' | 'avatar_frame'
  label     text not null,
  css       text not null default '',-- suffixe de classe ('' = aucun / défaut)
  min_level int  not null default 1,
  position  int  not null default 0
);

alter table public.cosmetics enable row level security;
drop policy if exists cosmetics_read  on public.cosmetics;
drop policy if exists cosmetics_staff on public.cosmetics;
create policy cosmetics_read  on public.cosmetics for select using (true);
create policy cosmetics_staff on public.cosmetics for all
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

insert into public.cosmetics (id, kind, label, css, min_level, position) values
  ('color:none',   'name_color',   'Défaut',       '',       1,  0),
  ('color:amber',  'name_color',   'Ambre',        'amber',  5,  10),
  ('color:rose',   'name_color',   'Rose',         'rose',   10, 20),
  ('color:violet', 'name_color',   'Violet',       'violet', 10, 30),
  ('color:teal',   'name_color',   'Sarcelle',     'teal',   20, 40),
  ('color:aurora', 'name_color',   'Aurore',       'aurora', 30, 50),
  ('color:gold',   'name_color',   'Or',           'gold',   50, 60),
  ('frame:none',   'avatar_frame', 'Aucun cadre',  '',       1,  0),
  ('frame:lueur',  'avatar_frame', 'Lueur',        'lueur',  5,  10),
  ('frame:flamme', 'avatar_frame', 'Flamme',       'flamme', 10, 20),
  ('frame:aurore', 'avatar_frame', 'Aurore',       'aurore', 30, 30),
  ('frame:astre',  'avatar_frame', 'Astre',        'astre',  50, 40)
on conflict (id) do update set
  kind = excluded.kind, label = excluded.label, css = excluded.css,
  min_level = excluded.min_level, position = excluded.position;

-- Empêche l'écriture directe de equipped : on passe par set_cosmetic (validé).
revoke update (equipped) on public.profiles from anon, authenticated;

-- Équipe un cosmétique si le rang du membre le débloque (sinon refus).
create or replace function public.set_cosmetic(p_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  v_kind text; v_css text; v_min int; v_level int; v_xp int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  select kind, css, min_level into v_kind, v_css, v_min from public.cosmetics where id = p_id;
  if v_kind is null then return jsonb_build_object('ok', false, 'error', 'unknown'); end if;

  select xp into v_xp from public.profiles where id = uid;
  v_level := level_from_xp(coalesce(v_xp, 0));
  if v_level < v_min then
    return jsonb_build_object('ok', false, 'error', 'locked', 'min_level', v_min);
  end if;

  if v_css = '' then                    -- « aucun / défaut » → on retire la clé
    update public.profiles set equipped = coalesce(equipped, '{}'::jsonb) - v_kind where id = uid;
  else
    update public.profiles
       set equipped = jsonb_set(coalesce(equipped, '{}'::jsonb), array[v_kind], to_jsonb(v_css))
     where id = uid;
  end if;

  return jsonb_build_object('ok', true, 'kind', v_kind, 'css', v_css);
end; $$;

grant execute on function public.set_cosmetic(text) to authenticated;

-- ----------------------------------------------------------------------
--  Succès DÉTECTÉS CÔTÉ CLIENT (série rattrapée, bibliothèque complète, etc.)
--  Le site détecte la condition (il connaît le catalogue / les chapitres) puis
--  appelle cette fonction. Liste blanche stricte : impossible d'octroyer un
--  autre succès. Cohérent avec le modèle « XP souple » déjà en place.
-- ----------------------------------------------------------------------
create or replace function public.grant_client_achievement(p_key text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_name text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_key not in ('series_1', 'library_full', 'early_10', 'marathon_2h') then
    return jsonb_build_object('ok', false, 'error', 'not_client_grantable');
  end if;
  v_name := grant_achievement(uid, p_key);   -- idempotent (revoke client OK : appelé en owner)
  return jsonb_build_object('ok', true, 'granted', v_name is not null, 'name', v_name);
end; $$;

grant execute on function public.grant_client_achievement(text) to authenticated;
