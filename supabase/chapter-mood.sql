-- =========================================================================
--  LanorTrad — « Ce chapitre t'a fait quoi ? » (réactions d'ambiance en fin
--  de chapitre). À COLLER dans Supabase → SQL Editor → New query → Run
--  (APRÈS schema.sql). Idempotent.
--  Un membre = une réaction par chapitre (modifiable ; re-cliquer = retirer).
--  L'agrégat est public (via RPC) ; qui a réagi quoi ne l'est pas.
-- =========================================================================

create table if not exists public.chapter_moods (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  manga_id    text not null check (char_length(manga_id) between 1 and 64),
  chapter_num text not null check (char_length(chapter_num) between 1 and 16),
  emoji       text not null check (emoji in ('🔥','😭','😂','😮')),
  created_at  timestamptz not null default now(),
  primary key (user_id, manga_id, chapter_num)
);
create index if not exists chapter_moods_chapter_idx
  on public.chapter_moods(manga_id, chapter_num);

alter table public.chapter_moods enable row level security;

-- Pas de lecture publique de la table : l'agrégat passe par la RPC ci-dessous.
drop policy if exists chmood_own on public.chapter_moods;
create policy chmood_own on public.chapter_moods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Agrégat public d'un chapitre + ma réaction (null si anonyme).
create or replace function public.chapter_mood(p_manga text, p_chapter text)
returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  counts jsonb;
  mine   text;
begin
  select coalesce(jsonb_object_agg(emoji, n), '{}'::jsonb) into counts
    from (select emoji, count(*)::int as n from public.chapter_moods
           where manga_id = p_manga and chapter_num = p_chapter
           group by emoji) t;
  if auth.uid() is not null then
    select emoji into mine from public.chapter_moods
     where user_id = auth.uid() and manga_id = p_manga and chapter_num = p_chapter;
  end if;
  return jsonb_build_object('ok', true, 'counts', counts, 'mine', mine);
end; $$;

-- Poser / changer / retirer (re-clic sur la même) sa réaction.
-- Renvoie l'agrégat à jour pour rafraîchir l'UI en un seul aller-retour.
create or replace function public.set_chapter_mood(p_manga text, p_chapter text, p_emoji text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_emoji not in ('🔥','😭','😂','😮') then
    return jsonb_build_object('ok', false, 'error', 'bad_emoji');
  end if;
  select emoji into cur from public.chapter_moods
   where user_id = uid and manga_id = p_manga and chapter_num = p_chapter;
  if cur = p_emoji then
    delete from public.chapter_moods
     where user_id = uid and manga_id = p_manga and chapter_num = p_chapter;
  else
    insert into public.chapter_moods (user_id, manga_id, chapter_num, emoji)
      values (uid, p_manga, p_chapter, p_emoji)
      on conflict (user_id, manga_id, chapter_num)
      do update set emoji = excluded.emoji, created_at = now();
  end if;
  return public.chapter_mood(p_manga, p_chapter);
end; $$;

grant execute on function public.chapter_mood(text, text)           to anon, authenticated;
grant execute on function public.set_chapter_mood(text, text, text) to authenticated;
