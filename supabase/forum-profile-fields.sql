-- =========================================================================
--  LanorTrad — Champs de profil supplémentaires (« rôles » des membres).
--  Ajoute : sexe, âge, types lus (Mangas/Oneshots…), genres préférés.
--  À COLLER tel quel dans : Supabase → SQL Editor → New query → Run.
--  Idempotent : ré-exécutable sans danger. À lancer UNE fois sur une base
--  déjà installée (voir FORUM-SETUP.md). Les nouvelles installations via
--  schema.sql l'incluent déjà.
-- =========================================================================

alter table public.profiles add column if not exists gender     text;
alter table public.profiles add column if not exists age        int;
alter table public.profiles add column if not exists reads      text[] not null default '{}';
alter table public.profiles add column if not exists fav_genres text[] not null default '{}';

-- Garde-fous (réexécutables) : valeurs plausibles. Le rendu côté site est de
-- toute façon échappé (anti-XSS) ; ces contraintes limitent surtout les abus.
do $$ begin
  alter table public.profiles
    add constraint profiles_age_chk check (age is null or age between 5 and 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_gender_chk check (gender is null or gender in ('Homme','Femme','Autre'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_reads_chk check (array_length(reads, 1) is null or array_length(reads, 1) <= 20);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_genres_chk check (array_length(fav_genres, 1) is null or array_length(fav_genres, 1) <= 30);
exception when duplicate_object then null; end $$;

-- (Les règles RLS de schema.sql couvrent déjà ces colonnes : chaque membre
--  modifie uniquement son propre profil, lecture publique.)
