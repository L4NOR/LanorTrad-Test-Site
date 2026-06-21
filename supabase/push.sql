-- =========================================================================
--  LanorTrad — Notifications push (Web Push)
--  À COLLER dans Supabase → SQL Editor → New query → Run (APRÈS schema.sql).
--  Stocke les abonnements push des visiteurs. Idempotent.
-- =========================================================================

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles(id) on delete set null,  -- null si visiteur non connecté
  endpoint   text unique not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Les écritures passent par la fonction Netlify (clé service_role, bypass RLS).
-- On autorise quand même l'utilisateur connecté à supprimer son propre abonnement.
drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_delete_own on public.push_subscriptions
  for delete using (auth.uid() = user_id);
