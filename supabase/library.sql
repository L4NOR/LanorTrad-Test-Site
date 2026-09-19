-- =========================================================================
--  LanorTrad — « Ma liste » : le statut de lecture de chaque série
--  (Je lis, À lire, En pause, Fini, Abandonné), partagé entre appareils.
--  À COLLER dans : Supabase → SQL Editor → New query → Run. Idempotent.
--  Indépendant du reste (seule l'auth Supabase est requise), même principe
--  que sync.sql : chaque membre ne voit et ne modifie QUE sa ligne (RLS).
--
--  Sans ce script, « Ma liste » marche quand même : elle reste sur
--  l'appareil, elle ne suit juste pas d'un téléphone à l'autre.
-- =========================================================================

-- UNE ligne par membre avec la liste complète, comme user_follows : c'est
-- ce qui permet à un retrait (« je l'enlève de ma liste ») de se propager.
create table if not exists public.user_library (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  statuses   jsonb not null default '{}',   -- { "Tougen Anki": "je-lis", … }
  t          bigint not null default 0,     -- horodatage client (ms) : « le plus récent gagne »
  updated_at timestamptz not null default now(),
  -- Un objet, et de taille raisonnable : une dizaine de séries tiennent en
  -- quelques centaines d'octets, 20 Ko laisse une marge énorme.
  constraint user_library_forme check (jsonb_typeof(statuses) = 'object' and pg_column_size(statuses) < 20000)
);

alter table public.user_library enable row level security;

drop policy if exists user_library_own on public.user_library;
create policy user_library_own on public.user_library
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
