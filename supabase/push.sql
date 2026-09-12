-- =========================================================================
--  LanorTrad — Notifications push (« un nouveau chapitre est sorti »).
--  À COLLER dans : Supabase → SQL Editor → New query → Run. Idempotent.
--
--  CE QU'EST UN ABONNEMENT PUSH
--  Une ADRESSE fournie par le navigateur du lecteur (Google, Mozilla, Apple
--  selon le navigateur) plus deux clés qui servent à chiffrer les messages.
--  Rien d'autre : ni email, ni compte, ni identité. Le site n'a pas besoin de
--  savoir QUI est derrière — seulement où frapper quand un chapitre sort.
--  C'est aussi pour ça que la table ne référence PAS auth.users : on peut être
--  prévenu sans avoir de compte, et avoir un compte sans être prévenu.
--
--  QUI TOUCHE À CETTE TABLE
--  Personne depuis le navigateur. RLS est activé SANS AUCUNE POLICY : la clé
--  publique du site ne peut ni lire ni écrire la table. Les seules portes sont
--  les trois fonctions ci-dessous (security definer, donc contrôlées) :
--    • push_subscribe   — s'abonner / mettre à jour ses séries
--    • push_unsubscribe — se désabonner
--    • push_stats       — le nombre d'abonnés, et rien d'autre
--  L'ENVOI se fait depuis Netlify (netlify/functions/) avec la clé
--  service_role, qui passe au-dessus de RLS. Cette clé ne va JAMAIS dans le
--  navigateur : elle vit dans les variables d'environnement Netlify.
-- =========================================================================

create table if not exists public.push_subs (
  endpoint   text primary key,
  -- Clés du chiffrement de charge utile. Le site envoie aujourd'hui des pings
  -- SANS contenu (le service worker va lire push/latest.json lui-même), donc
  -- elles ne servent pas encore. On les garde : elles font partie de
  -- l'abonnement, et sans elles, passer un jour aux messages chiffrés
  -- obligerait à faire se réabonner tout le monde.
  p256dh     text not null,
  auth       text not null,
  -- Séries suivies au moment de l'abonnement. Tableau VIDE = « préviens-moi
  -- pour toutes les sorties ». Sert à ne réveiller que les gens concernés :
  -- un téléphone qu'on réveille pour rien, c'est un désabonnement.
  follows    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Ménage : le service de push répond 404/410 quand un abonnement est mort
  -- (appli désinstallée, navigateur réinitialisé). L'envoyeur supprime alors
  -- la ligne. `fails` compte les autres échecs, pour repérer une panne.
  last_ok    timestamptz,
  fails      integer not null default 0
);

alter table public.push_subs enable row level security;
-- Volontairement AUCUNE policy : tout passe par les fonctions ci-dessous.

-- Mémoire de l'envoyeur : « quel chapitre ai-je déjà annoncé ? ». Une seule
-- ligne (k = 'last'), mais une table clé/valeur coûte le même prix et servira
-- au prochain besoin du même genre.
create table if not exists public.push_state (
  k          text primary key,
  v          jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.push_state enable row level security;
-- Idem : lue et écrite uniquement par Netlify (clé service_role).

/* ----------------------------------------------------------- s'abonner
   Appelée par js/push.js juste après que le lecteur a dit oui. Idempotente :
   réappelée à chaque changement de séries suivies, elle met à jour la ligne.

   Les garde-fous ne sont pas décoratifs : cette fonction est ouverte à tout
   porteur de la clé publique du site, c'est-à-dire à n'importe quel visiteur.
   Sans eux, ce serait un formulaire d'insertion libre dans la base.          */
create or replace function public.push_subscribe(
  p_endpoint text,
  p_p256dh   text,
  p_auth     text,
  p_follows  jsonb default '[]'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_follows jsonb := coalesce(p_follows, '[]'::jsonb);
begin
  -- Une adresse de push est une URL https, pas un champ libre.
  if p_endpoint is null or p_endpoint !~ '^https://[a-zA-Z0-9.-]+/' or length(p_endpoint) > 2000 then
    raise exception 'adresse de push invalide';
  end if;
  if coalesce(length(p_p256dh), 0) not between 1 and 300
     or coalesce(length(p_auth), 0) not between 1 and 300 then
    raise exception 'clés de push invalides';
  end if;
  -- Un tableau de noms de séries, et pas 10 000 : on borne.
  if jsonb_typeof(v_follows) <> 'array' or jsonb_array_length(v_follows) > 200 then
    v_follows := '[]'::jsonb;
  end if;

  insert into public.push_subs (endpoint, p256dh, auth, follows, updated_at)
  values (p_endpoint, p_p256dh, p_auth, v_follows, now())
  on conflict (endpoint) do update
    set p256dh     = excluded.p256dh,
        auth       = excluded.auth,
        follows    = excluded.follows,
        updated_at = now(),
        fails      = 0;
end;
$$;

/* --------------------------------------------------------- se désabonner
   Le lecteur reste maître : un clic et la ligne disparaît. On ne garde pas
   d'« abonnement désactivé », il n'y a rien à conserver.                    */
create or replace function public.push_unsubscribe(p_endpoint text)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  delete from public.push_subs where endpoint = p_endpoint;
$$;

/* ------------------------------------------------------------- combien
   Le seul chiffre exposé publiquement. Sert à la page /diag.html (« le script
   est-il déployé ? ») et à l'affichage « N appareils prévenus ». Ne révèle
   aucune adresse : count(*) et c'est tout.                                  */
create or replace function public.push_stats()
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(*)::int from public.push_subs;
$$;

revoke all on function public.push_subscribe(text, text, text, jsonb) from public;
revoke all on function public.push_unsubscribe(text)                  from public;
revoke all on function public.push_stats()                            from public;
grant execute on function public.push_subscribe(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.push_unsubscribe(text)                  to anon, authenticated;
grant execute on function public.push_stats()                            to anon, authenticated;

-- Vérification : doit renvoyer 0 sur une base neuve.
--   select public.push_stats();
