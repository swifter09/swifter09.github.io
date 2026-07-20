create extension if not exists pgcrypto;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null check (source_type in ('rss', 'podcast', 'github', 'wechat', 'manual')),
  category text not null check (category in ('ai', 'article', 'podcast', 'project', 'tech_feed')),
  feed_url text,
  homepage_url text,
  enabled boolean not null default true,
  requires_review boolean not null default true,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, source_type)
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
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

alter table public.content_items add column if not exists source_id uuid references public.sources(id) on delete set null;
alter table public.content_items add column if not exists external_id text;
alter table public.content_items add column if not exists discovered_at timestamptz not null default now();
create unique index if not exists content_items_url_unique on public.content_items (url);
create index if not exists content_items_status_created_idx on public.content_items (status, created_at desc);
create index if not exists sources_enabled_type_idx on public.sources (enabled, source_type);

alter table public.content_items enable row level security;
alter table public.sources enable row level security;

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

drop policy if exists "Owner can read sources" on public.sources;
create policy "Owner can read sources"
on public.sources for select
using (public.is_blog_admin());

drop policy if exists "Owner can create sources" on public.sources;
create policy "Owner can create sources"
on public.sources for insert
with check (public.is_blog_admin());

drop policy if exists "Owner can update sources" on public.sources;
create policy "Owner can update sources"
on public.sources for update
using (public.is_blog_admin())
with check (public.is_blog_admin());

drop policy if exists "Owner can delete sources" on public.sources;
create policy "Owner can delete sources"
on public.sources for delete
using (public.is_blog_admin());
