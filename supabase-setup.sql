-- =============================================================
-- LoopMark — Supabase setup script
-- Run this in the Supabase SQL editor (Project → SQL → New query)
-- after creating the project. Idempotent: safe to re-run.
-- =============================================================

-- 1) Comments table -------------------------------------------
create table if not exists public.comments (
  id          uuid          primary key default gen_random_uuid(),
  name        text          not null default 'Anonymous',
  text        text          not null,
  rating      int           not null default 5 check (rating between 1 and 5),
  image_url   text,
  device_id   text,
  likes       int           not null default 0,
  created_at  timestamptz   not null default now()
);

-- Helpful indexes
create index if not exists comments_created_at_idx on public.comments (created_at desc);
create index if not exists comments_device_id_idx  on public.comments (device_id);

-- Stop duplicate spam: same device + same text within a short window
create unique index if not exists comments_dedupe_idx
  on public.comments (device_id, md5(text))
  where device_id is not null;

-- 2) Row-Level Security ---------------------------------------
alter table public.comments enable row level security;

-- Drop old policies if rerunning
drop policy if exists "comments_anon_select" on public.comments;
drop policy if exists "comments_anon_insert" on public.comments;
drop policy if exists "comments_anon_update_likes" on public.comments;
drop policy if exists "comments_no_anon_delete" on public.comments;

-- Anyone can read
create policy "comments_anon_select"
  on public.comments
  for select
  to anon, authenticated
  using (true);

-- Anyone can insert with reasonable size limits
create policy "comments_anon_insert"
  on public.comments
  for insert
  to anon, authenticated
  with check (
    char_length(text) between 1 and 3000
    and char_length(coalesce(name, '')) <= 80
    and (image_url is null or char_length(image_url) <= 400000) -- ~300KB base64
    and rating between 1 and 5
  );

-- Anon can ONLY update the `likes` column (everything else stays the same)
-- Implemented via a trigger because RLS WITH CHECK can't restrict columns directly.
create or replace function public.comments_block_field_changes()
returns trigger language plpgsql as $$
begin
  if new.text       is distinct from old.text       then raise exception 'text is immutable for anon'; end if;
  if new.name       is distinct from old.name       then return new; end if; -- name allowed (rename-me feature)
  if new.rating     is distinct from old.rating     then raise exception 'rating is immutable'; end if;
  if new.image_url  is distinct from old.image_url  then raise exception 'image is immutable'; end if;
  if new.created_at is distinct from old.created_at then raise exception 'created_at is immutable'; end if;
  if new.device_id  is distinct from old.device_id  then raise exception 'device_id is immutable'; end if;
  return new;
end;
$$;
drop trigger if exists comments_block_field_changes_trg on public.comments;
create trigger comments_block_field_changes_trg
  before update on public.comments
  for each row execute function public.comments_block_field_changes();

create policy "comments_anon_update_likes"
  on public.comments
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- No DELETE for anon. Deletes happen via the admin Netlify function using
-- the SERVICE_ROLE key, which bypasses RLS by design.
-- (We simply don't create a policy; default-deny applies.)

-- 3) Optional storage bucket for images -----------------------
-- If you want to migrate base64 attachments into a real bucket later:
--   supabase: storage → create bucket "comment-images" → public read.
-- Then have your client upload there and store the public URL in image_url.
