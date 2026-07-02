-- =========================================================================
--  LanorTrad — Premium : chapitres en avance verrouillés (Supabase).
--  À COLLER tel quel dans : Supabase → SQL Editor → New query → Run.
--  Idempotent : ré-exécutable sans danger. À lancer APRÈS schema.sql.
--
--  Modèle : Premium = statut sur le profil (premium_until). Les chapitres
--  « en avance » vivent dans un bucket PRIVÉ ; une policy RLS autorise la
--  lecture si le chapitre a dépassé le délai gratuit OU si le membre est
--  premium. Le lecteur génère des signed URLs (createSignedUrl).
-- =========================================================================

-- ----------------------------------------------------------------------
--  1) Statut premium sur le profil
-- ----------------------------------------------------------------------
alter table public.profiles add column if not exists premium_until timestamptz;

-- Helper : l'utilisateur est-il premium ACTIF ? (SECURITY DEFINER pour être
-- appelable depuis les policies RLS sans souci de permission/récursion.)
create or replace function public.is_premium(uid uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = uid and premium_until is not null and premium_until > now()
  );
$$;
grant execute on function public.is_premium(uuid) to anon, authenticated;

-- Délai avant qu'un chapitre en avance devienne gratuit.
-- ⚙️  Source de vérité côté serveur. Doit correspondre à freeDelayDays dans
--     js/data/premium-config.js (utilisé seulement pour l'affichage).
create or replace function public.premium_free_delay()
returns interval language sql immutable as $$
  select interval '7 days';
$$;
grant execute on function public.premium_free_delay() to anon, authenticated;

-- ----------------------------------------------------------------------
--  2) Manifeste des chapitres en avance (lecture publique)
--     Le site doit connaître la liste + les dates pour afficher les cadenas.
-- ----------------------------------------------------------------------
create table if not exists public.premium_chapters (
  manga_id    text not null,
  chapter_num text not null,
  released    timestamptz not null default now(),
  pages       int not null default 0,
  primary key (manga_id, chapter_num)
);

alter table public.premium_chapters enable row level security;

-- Lecture publique du manifeste (pas les images — juste les métadonnées).
drop policy if exists premium_chapters_read on public.premium_chapters;
create policy premium_chapters_read on public.premium_chapters for select using (true);
-- Écriture : réservée au service_role (script premium-upload.py, qui contourne
-- la RLS) et au staff via l'éditeur. Pas de policy anon/authenticated → refus.
drop policy if exists premium_chapters_staff on public.premium_chapters;
create policy premium_chapters_staff on public.premium_chapters for all
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------
--  3) Codes premium à usage unique + RPC de rédemption
-- ----------------------------------------------------------------------
create table if not exists public.premium_codes (
  code     text primary key,
  months   int not null default 1 check (months between 1 and 24),
  used_by  uuid references public.profiles(id) on delete set null,
  used_at  timestamptz
);

alter table public.premium_codes enable row level security;
-- Aucun accès direct anon/authenticated (les codes ne doivent pas fuiter).
-- La RPC redeem_code (SECURITY DEFINER) contourne la RLS ; le staff peut gérer.
drop policy if exists premium_codes_staff on public.premium_codes;
create policy premium_codes_staff on public.premium_codes for all
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Redemption : consomme un code non utilisé et prolonge premium_until.
create or replace function public.redeem_code(p_code text)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_code   text := upper(trim(p_code));
  v_months int;
  v_new    timestamptz;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour activer un code.' using errcode = 'P0001';
  end if;

  select months into v_months
    from public.premium_codes
   where code = v_code and used_by is null
   for update;

  if v_months is null then
    raise exception 'Code invalide ou déjà utilisé.' using errcode = 'P0001';
  end if;

  update public.premium_codes
     set used_by = v_uid, used_at = now()
   where code = v_code;

  update public.profiles
     set premium_until = greatest(coalesce(premium_until, now()), now())
                         + (v_months || ' months')::interval
   where id = v_uid
   returning premium_until into v_new;

  return v_new;
end; $$;
grant execute on function public.redeem_code(text) to authenticated;

-- ----------------------------------------------------------------------
--  4) Bucket privé + policy de lecture (date OU premium)
-- ----------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('premium-chapters', 'premium-chapters', false)
on conflict (id) do nothing;

-- Chemin d'objet attendu : <manga_id>/<chapter_num>/001.webp
--   → (storage.foldername(name))[1] = manga_id ; [2] = chapter_num
drop policy if exists "premium_read_gate" on storage.objects;
create policy "premium_read_gate" on storage.objects
  for select using (
    bucket_id = 'premium-chapters'
    and exists (
      select 1 from public.premium_chapters pc
      where pc.manga_id    = (storage.foldername(name))[1]
        and pc.chapter_num = (storage.foldername(name))[2]
        and ( now() - pc.released >= public.premium_free_delay()
              or public.is_premium(auth.uid()) )
    )
  );

-- =========================================================================
--  ADMIN — après paiement d'un membre, créez-lui un code :
--    insert into public.premium_codes (code, months) values ('LANOR-AB12', 1);
--  Se nommer premium à la main (test) :
--    update public.profiles set premium_until = now() + interval '1 month'
--     where username = 'TON_PSEUDO';
-- =========================================================================
