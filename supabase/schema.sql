-- =========================================================================
--  LanorTrad — Forum communautaire (Supabase / PostgreSQL)
--  À COLLER tel quel dans : Supabase → SQL Editor → New query → Run.
--  Idempotent : ré-exécutable sans danger.
--  Voir FORUM-SETUP.md pour la marche à suivre complète.
-- =========================================================================

-- ----------------------------------------------------------------------
--  TABLES
-- ----------------------------------------------------------------------

-- Profils publics (1 par compte). Le compte (email/mot de passe) vit dans
-- auth.users, géré par Supabase ; ici on ne stocke QUE l'info publique.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  avatar_url text,
  bio        text,
  gender     text,                              -- 'Homme' | 'Femme' | 'Autre'
  age        int,
  reads      text[] not null default '{}',      -- types lus : Mangas, Oneshots…
  fav_genres text[] not null default '{}',      -- genres préférés
  role       text not null default 'member',    -- 'member' | 'moderator' | 'admin'
  created_at timestamptz not null default now()
);

-- Champs de profil (« rôles ») : ajout idempotent pour les bases déjà créées
-- avant cette version. Voir aussi supabase/forum-profile-fields.sql.
alter table public.profiles add column if not exists gender     text;
alter table public.profiles add column if not exists age        int;
alter table public.profiles add column if not exists reads      text[] not null default '{}';
alter table public.profiles add column if not exists fav_genres text[] not null default '{}';
do $$ begin
  alter table public.profiles add constraint profiles_age_chk
    check (age is null or age between 5 and 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_gender_chk
    check (gender is null or gender in ('Homme','Femme','Autre'));
exception when duplicate_object then null; end $$;

create table if not exists public.categories (
  id          bigint generated always as identity primary key,
  slug        text unique not null,
  name        text not null,
  description text,
  icon        text,                              -- emoji
  color       text,                              -- accent hex
  position    int not null default 0
);

create table if not exists public.topics (
  id            bigint generated always as identity primary key,
  category_id   bigint not null references public.categories(id) on delete cascade,
  author_id     uuid   not null references public.profiles(id)   on delete cascade,
  title         text not null check (char_length(title) between 3 and 140),
  body          text not null check (char_length(body) between 1 and 10000),
  pinned        boolean not null default false,
  locked        boolean not null default false,
  reply_count   int not null default 0,
  created_at    timestamptz not null default now(),
  last_activity timestamptz not null default now()
);
create index if not exists topics_category_idx on public.topics(category_id, last_activity desc);

create table if not exists public.posts (
  id         bigint generated always as identity primary key,
  topic_id   bigint not null references public.topics(id)   on delete cascade,
  author_id  uuid   not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists posts_topic_idx on public.posts(topic_id, created_at);

-- ----------------------------------------------------------------------
--  FONCTIONS + TRIGGERS
-- ----------------------------------------------------------------------

-- À la création d'un compte → crée automatiquement son profil public.
-- Le pseudo provient des métadonnées passées au signup côté site.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''),
             'membre_' || substr(new.id::text, 1, 8))
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tient à jour reply_count + last_activity du sujet quand on poste/supprime.
create or replace function public.bump_topic_on_post()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.topics
       set reply_count = reply_count + 1, last_activity = new.created_at
     where id = new.topic_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.topics
       set reply_count = greatest(reply_count - 1, 0)
     where id = old.topic_id;
    return old;
  end if;
  return null;
end; $$;

drop trigger if exists trg_post_count on public.posts;
create trigger trg_post_count
  after insert or delete on public.posts
  for each row execute function public.bump_topic_on_post();

-- Helper : l'utilisateur est-il modérateur/admin ? (SECURITY DEFINER pour
-- éviter toute récursion RLS quand on l'appelle depuis les policies.)
create or replace function public.is_staff(uid uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('admin', 'moderator')
  );
$$;

-- ----------------------------------------------------------------------
--  VUE : statistiques par catégorie (nb de sujets + dernière activité)
-- ----------------------------------------------------------------------
create or replace view public.category_stats
with (security_invoker = true) as
  select c.id,
         count(t.id)                          as topic_count,
         coalesce(sum(t.reply_count), 0)::int as reply_count,
         max(t.last_activity)                 as last_activity
    from public.categories c
    left join public.topics t on t.category_id = c.id
   group by c.id;

grant select on public.category_stats to anon, authenticated;

-- ----------------------------------------------------------------------
--  ROW LEVEL SECURITY  (les règles d'accès vivent dans la base)
-- ----------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.categories enable row level security;
alter table public.topics     enable row level security;
alter table public.posts      enable row level security;

-- PROFILES : lecture publique ; chacun modifie le sien ; staff peut tout.
drop policy if exists profiles_read       on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_staff      on public.profiles;
create policy profiles_read       on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_staff      on public.profiles for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- CATEGORIES : lecture publique ; écriture réservée au staff.
drop policy if exists categories_read  on public.categories;
drop policy if exists categories_staff on public.categories;
create policy categories_read  on public.categories for select using (true);
create policy categories_staff on public.categories for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- TOPICS : lecture publique ; création/édition/suppression par l'auteur ;
--          staff peut tout (épingler, verrouiller, supprimer).
drop policy if exists topics_read        on public.topics;
drop policy if exists topics_insert_self on public.topics;
drop policy if exists topics_update_own  on public.topics;
drop policy if exists topics_delete_own  on public.topics;
drop policy if exists topics_staff       on public.topics;
create policy topics_read        on public.topics for select using (true);
create policy topics_insert_self on public.topics for insert with check (auth.uid() = author_id);
create policy topics_update_own  on public.topics for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy topics_delete_own  on public.topics for delete using (auth.uid() = author_id);
create policy topics_staff       on public.topics for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- POSTS : lecture publique ; on poste si connecté ET sujet non verrouillé ;
--         édition/suppression par l'auteur ; staff peut tout.
drop policy if exists posts_read        on public.posts;
drop policy if exists posts_insert_self on public.posts;
drop policy if exists posts_update_own  on public.posts;
drop policy if exists posts_delete_own  on public.posts;
drop policy if exists posts_staff       on public.posts;
create policy posts_read        on public.posts for select using (true);
create policy posts_insert_self on public.posts for insert with check (
  auth.uid() = author_id
  and not exists (select 1 from public.topics t where t.id = topic_id and t.locked)
);
create policy posts_update_own  on public.posts for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy posts_delete_own  on public.posts for delete using (auth.uid() = author_id);
create policy posts_staff       on public.posts for all using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------
--  CATÉGORIES DE DÉPART  (modifiables ensuite)
-- ----------------------------------------------------------------------
insert into public.categories (slug, name, description, icon, color, position) values
  ('annonces',    'Annonces',    'Annonces officielles de LanorTrad',                       '📢', '#a855f7', 1),
  ('discussions', 'Discussions', 'Discussions générales sur les mangas, manhwas et webtoons','💬', '#6366f1', 2),
  ('suggestions', 'Suggestions', 'Proposez vos idées et les séries à traduire',              '💡', '#f59e0b', 3),
  ('aide',        'Aide',        'Besoin d''aide ? Posez vos questions ici',                 '🛟', '#10b981', 4),
  ('off-topic',   'Off-topic',   'Discussions libres, hors-sujet',                           '🎲', '#ec4899', 5)
on conflict (slug) do nothing;

-- =========================================================================
--  ASTUCE : pour te nommer admin (après ta 1re inscription), exécute :
--    update public.profiles set role = 'admin' where username = 'TON_PSEUDO';
-- =========================================================================
