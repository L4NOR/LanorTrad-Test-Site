-- =========================================================================
--  LanorTrad — Avatars de profil (Supabase Storage)
--  À COLLER dans Supabase → SQL Editor → New query → Run (APRÈS schema.sql).
--  Crée un bucket public "avatars" ; chaque membre ne peut écrire que dans
--  son propre dossier (avatars/<son-id>/…). Idempotent.
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Lecture publique des avatars
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Écriture réservée à l'utilisateur, dans son dossier (1er segment = son uid)
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
