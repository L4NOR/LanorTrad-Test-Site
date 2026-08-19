-- =========================================================================
--  LanorTrad — « X lecteurs en ce moment »
--  À COLLER dans Supabase → SQL Editor → New query → Run. Idempotent.
--
--  Le site affiche déjà des compteurs, mais tous froids : des totaux, des
--  tendances, de l'agrégat. Rien ne dit qu'il y a QUELQU'UN d'autre, là,
--  maintenant, sur le même chapitre. C'est ce que fait ce fichier.
--
--  CE QUI EST ENREGISTRÉ, ET CE QUI NE L'EST PAS
--  Une ligne par onglet ouvert : un identifiant tiré au hasard par le
--  navigateur, la page regardée, et l'heure du dernier signe de vie.
--  Pas d'adresse IP, pas d'identifiant de compte, aucun lien avec un membre —
--  la présence d'un visiteur connecté est donc aussi anonyme que celle d'un
--  autre. Les lignes sont effacées au bout de deux minutes d'inactivité, à
--  chaque appel : la table ne garde aucun historique et ne grossit pas.
--
--  RLS : la table n'est lisible ni écrivable directement. Tout passe par
--  presence_ping(), qui ne renvoie qu'un NOMBRE — jamais la liste.
-- =========================================================================

create table if not exists public.presence (
  id      text primary key,          -- identifiant anonyme, tiré par le navigateur
  scope   text not null,             -- ce qui est regardé (« serie:Tougen Anki »)
  seen_at timestamptz not null default now()
);

create index if not exists presence_scope_idx on public.presence (scope, seen_at);

alter table public.presence enable row level security;
-- Aucune policy : volontaire. Personne n'accède à la table en direct.

-- Signale sa présence et renvoie le nombre de personnes sur la même page.
create or replace function public.presence_ping(p_id text, p_scope text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  -- Garde-fous : l'appel vient du navigateur, donc de n'importe qui.
  if p_id is null or length(p_id) < 8 or length(p_id) > 64 then return 0; end if;
  if p_scope is null or length(p_scope) < 1 or length(p_scope) > 120 then return 0; end if;

  -- Ménage à chaque appel : pas de tâche planifiée à surveiller, et la table
  -- ne contient jamais que les présents.
  delete from public.presence where seen_at < now() - interval '2 minutes';

  insert into public.presence (id, scope, seen_at)
       values (p_id, p_scope, now())
  on conflict (id) do update set scope = excluded.scope, seen_at = now();

  select count(*) into v_n
    from public.presence
   where scope = p_scope and seen_at > now() - interval '90 seconds';

  return v_n;
end; $$;

revoke all on function public.presence_ping(text, text) from public;
grant execute on function public.presence_ping(text, text) to anon, authenticated;

-- Vérification :
--   select public.presence_ping('test-diagnostic-1', 'serie:Tougen Anki');  -- 1
--   select public.presence_ping('test-diagnostic-2', 'serie:Tougen Anki');  -- 2
--   delete from public.presence where id like 'test-diagnostic-%';
