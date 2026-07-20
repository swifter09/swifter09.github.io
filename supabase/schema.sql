create extension if not exists pgcrypto;

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('ai', 'article', 'podcast', 'project', 'tech_feed')),
  title text not null,
  summary text,
  url text not null,
  source text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_items enable row level security;

create or replace function public.is_blog_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'user_name') = 'swifter09'
    or (auth.jwt() -> 'user_metadata' ->> 'preferred_username') = 'swifter09',
    false
  );
$$;

drop policy if exists "Published content is public" on public.content_items;
create policy "Published content is public"
on public.content_items for select
using (status = 'published' or public.is_blog_admin());

drop policy if exists "Owner can create content" on public.content_items;
create policy "Owner can create content"
on public.content_items for insert
with check (public.is_blog_admin());

drop policy if exists "Owner can update content" on public.content_items;
create policy "Owner can update content"
on public.content_items for update
using (public.is_blog_admin())
with check (public.is_blog_admin());

drop policy if exists "Owner can delete content" on public.content_items;
create policy "Owner can delete content"
on public.content_items for delete
using (public.is_blog_admin());
