-- =========================================================================
--  LanorTrad — XP des RÉACTIONS reçues (déclencheur).
--  À COLLER dans : Supabase → SQL Editor → New query → Run.
--  Idempotent. Nécessite : schema.sql + forum-reactions-notifications.sql
--  (table public.reactions) + gamification.sql (check_achievements, xp_events).
--
--  Quand quelqu'un réagit à ton sujet/message, tu gagnes de l'XP (2, plafond
--  20/jour, 1 fois par membre réagissant et par contenu — pas d'auto-réaction).
-- =========================================================================

-- Crédite l'XP de réaction au DESTINATAIRE (respecte le plafond journalier).
-- Réservée au serveur (appelée par le trigger) : accès client révoqué.
create or replace function public.award_reaction_xp(p_recipient uuid, p_ref text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_daily int;
  v_xp    int;
begin
  select coalesce(sum(xp), 0) into v_daily
    from public.xp_events
   where user_id = p_recipient and kind = 'reaction'
     and (created_at at time zone 'Europe/Paris')::date = v_today;
  v_xp := least(2, greatest(0, 20 - v_daily));

  insert into public.xp_events (user_id, kind, ref, xp)
    values (p_recipient, 'reaction', p_ref, v_xp)
    on conflict (user_id, kind, ref) do nothing;
  if not found then return; end if;                       -- réaction déjà comptée

  update public.profiles
     set xp = xp + v_xp, reactions_count = reactions_count + 1
   where id = p_recipient;
  perform public.check_achievements(p_recipient);
end; $$;

revoke execute on function public.award_reaction_xp(uuid, text) from public, anon, authenticated;

-- Déclencheur : à chaque réaction insérée, crédite l'auteur du contenu visé.
create or replace function public.tg_reaction_xp()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if new.target_kind = 'topic' then
    select author_id into v_author from public.topics where id = new.target_id;
  elsif new.target_kind = 'post' then
    select author_id into v_author from public.posts where id = new.target_id;
  end if;
  if v_author is null or v_author = new.user_id then return new; end if;   -- pas d'auto-XP
  perform public.award_reaction_xp(
    v_author,
    'reaction:' || new.target_kind || ':' || new.target_id || ':' || new.user_id
  );
  return new;
end; $$;

drop trigger if exists trg_reaction_xp on public.reactions;
create trigger trg_reaction_xp
  after insert on public.reactions
  for each row execute function public.tg_reaction_xp();

-- Rattrapage : réactions déjà reçues (hors auto-réactions).
update public.profiles p set reactions_count = coalesce((
  select count(*)
    from public.reactions r
    left join public.topics t on r.target_kind = 'topic' and t.id = r.target_id
    left join public.posts  po on r.target_kind = 'post'  and po.id = r.target_id
   where coalesce(t.author_id, po.author_id) = p.id and r.user_id <> p.id
), 0);
