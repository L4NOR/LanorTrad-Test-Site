-- =========================================================================
--  LanorTrad — Abonnements aux notifications push (bloc 4).
--  À COLLER dans : Supabase → SQL Editor → New query → Run. Idempotent.
--  Indépendant. L'envoi se fait depuis une fonction Netlify avec la clé
--  service_role (qui contourne la RLS) — voir GAMIFICATION-SETUP.md.
-- =========================================================================

create table if not exists public.push_subscriptions (
  endpoint   text primary key,          -- identifiant unique de l'abonnement (navigateur)
  p256dh     text not null,             -- clés de chiffrement (Web Push)
  auth       text not null,
  series     text[] not null default '{}', -- séries suivies au moment de l'abonnement
  user_id    uuid,                      -- si connecté (facultatif : push ≠ compte requis)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Réconcilie une table PRÉ-EXISTANTE (d'un ancien essai) : ajoute les colonnes
-- manquantes si besoin (le `create table if not exists` ci-dessus ne modifie pas
-- une table déjà là). Sans effet sur une table fraîchement créée.
alter table public.push_subscriptions add column if not exists p256dh     text;
alter table public.push_subscriptions add column if not exists auth       text;
alter table public.push_subscriptions add column if not exists series     text[] not null default '{}';
alter table public.push_subscriptions add column if not exists user_id    uuid;
alter table public.push_subscriptions add column if not exists created_at timestamptz not null default now();
alter table public.push_subscriptions add column if not exists updated_at timestamptz not null default now();

-- RLS activée SANS policy de lecture : les endpoints ne sont jamais exposés au
-- client. L'écriture passe par les fonctions ci-dessous ; l'envoi (Netlify) lit
-- la table avec la clé service_role (bypass RLS).
alter table public.push_subscriptions enable row level security;

-- Enregistre / met à jour un abonnement (upsert par endpoint).
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_series text[])
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_endpoint is null or p_endpoint = '' then return; end if;
  insert into public.push_subscriptions (endpoint, p256dh, auth, series, user_id, updated_at)
    values (p_endpoint, p_p256dh, p_auth, coalesce(p_series, '{}'), auth.uid(), now())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, series = excluded.series,
        user_id = excluded.user_id, updated_at = now();
end; $$;

-- Désabonnement (le client ne connaît que SON endpoint, non devinable).
create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint;
end; $$;

grant execute on function public.save_push_subscription(text, text, text, text[]) to anon, authenticated;
grant execute on function public.delete_push_subscription(text)                    to anon, authenticated;
