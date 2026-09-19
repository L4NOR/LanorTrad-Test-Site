-- =========================================================================
--  LanorTrad — « Devine la case » : l'XP du jeu quotidien.
--  À COLLER dans Supabase → SQL Editor → New query → Run. Idempotent.
--  Nécessite gamification.sql (xp_events, profiles.xp, check_achievements).
--
--  Le jeu lui-même tourne dans le navigateur (js/devine.js) : la case du
--  jour est tirée du catalogue, la même pour tout le monde. La base ne sert
--  qu'à créditer l'XP, UNE fois par membre et par jour, 50 XP au plus.
--
--  Comme tout le système d'XP d'un site statique, c'est une XP « souple » :
--  le serveur ne peut pas revérifier la partie. D'où le plafond bas et
--  l'unicité par jour — tricher rapporterait au mieux 50 XP par jour.
--
--  Sans ce script, le jeu marche quand même : il ne rapporte juste rien.
-- =========================================================================

create or replace function public.claim_devine(p_day text, p_score int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  today date := (now() at time zone 'Europe/Paris')::date;
  d     date;
  pts   int := least(greatest(coalesce(p_score, 0), 0), 50);
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  begin
    d := p_day::date;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'bad_day');
  end;
  -- La case du jour, ou celle de la veille (partie commencée avant minuit).
  if d not in (today, today - 1) then return jsonb_build_object('ok', false, 'error', 'bad_day'); end if;
  if pts = 0 then return jsonb_build_object('ok', true, 'xp', 0); end if;

  insert into public.xp_events (user_id, kind, ref, xp) values (uid, 'devine', d::text, pts)
    on conflict (user_id, kind, ref) do nothing;
  if not found then return jsonb_build_object('ok', true, 'xp', 0, 'already', true); end if;

  update public.profiles set xp = xp + pts where id = uid;
  perform public.check_achievements(uid);
  return jsonb_build_object('ok', true, 'xp', pts);
end; $$;

-- Laissée appelable sans compte (elle répond alors « not_authenticated ») :
-- c'est ce qui permet à diag.html de vérifier qu'elle est bien installée.
grant execute on function public.claim_devine(text, int) to anon, authenticated;
