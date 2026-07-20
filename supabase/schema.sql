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
alter table public.content_items add column if not exists title_zh text;
alter table public.content_items add column if not exists summary_zh text;
alter table public.content_items add column if not exists body text;
alter table public.content_items add column if not exists reader_content text;
alter table public.content_items add column if not exists reader_content_zh text;
alter table public.content_items add column if not exists audio_url text;
alter table public.content_items add column if not exists duration text;
alter table public.content_items add column if not exists source_published_at timestamptz;
alter table public.content_items add column if not exists dedupe_key text;
alter table public.content_items alter column url drop not null;
create unique index if not exists content_items_url_unique on public.content_items (url);
create index if not exists content_items_status_created_idx on public.content_items (status, created_at desc);
create index if not exists sources_enabled_type_idx on public.sources (enabled, source_type);

with ranked_content as (
  select
    id,
    encode(
      digest(
        coalesce(source_id::text, lower(coalesce(source, '')))
        || ':' || category
        || ':' || lower(regexp_replace(trim(title), '\s+', ' ', 'g')),
        'sha256'
      ),
      'hex'
    ) as generated_key,
    row_number() over (
      partition by
        coalesce(source_id::text, lower(coalesce(source, ''))),
        category,
        lower(regexp_replace(trim(title), '\s+', ' ', 'g'))
      order by
        case status when 'published' then 0 when 'review' then 1 else 2 end,
        created_at asc
    ) as duplicate_rank
  from public.content_items
)
update public.content_items as content
set dedupe_key = ranked.generated_key
from ranked_content as ranked
where content.id = ranked.id
  and ranked.duplicate_rank = 1
  and content.dedupe_key is null;

create unique index if not exists content_items_dedupe_key_unique
on public.content_items (dedupe_key)
where dedupe_key is not null;

update public.content_items
set source_published_at = published_at
where source_published_at is null
  and status in ('draft', 'review')
  and published_at is not null;

grant select, insert, update on public.sources to service_role;
grant select, insert, update on public.content_items to service_role;
grant select, insert, update, delete on public.sources to authenticated;
grant select, insert, update, delete on public.content_items to authenticated;
grant select on public.content_items to anon;

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
drop policy if exists "Enabled sources are public" on public.sources;
create policy "Enabled sources are public"
on public.sources for select
using (enabled or public.is_blog_admin());

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

insert into public.sources (name, source_type, category, feed_url, homepage_url)
values
  ('GitHub AI & ML', 'rss', 'ai', 'https://github.blog/ai-and-ml/feed/', 'https://github.blog/ai-and-ml/'),
  ('OpenAI News', 'rss', 'ai', 'https://openai.com/news/rss.xml', 'https://openai.com/news/'),
  ('Google DeepMind', 'rss', 'ai', 'https://deepmind.google/blog/rss.xml', 'https://deepmind.google/blog/'),
  ('Hugging Face Blog', 'rss', 'ai', 'https://huggingface.co/blog/feed.xml', 'https://huggingface.co/blog'),
  ('Google AI Blog', 'rss', 'ai', 'https://blog.google/technology/ai/rss/', 'https://blog.google/technology/ai/'),
  ('arXiv cs.AI', 'rss', 'ai', 'https://rss.arxiv.org/rss/cs.AI', 'https://arxiv.org/list/cs.AI/recent'),
  ('罗永浩的十字路口', 'podcast', 'podcast', 'https://feed.xyzfm.space/wmnkvmrpwuww', 'https://www.xiaoyuzhoufm.com/podcast/68981df29e7bcd326eb91d88'),
  ('硅谷101', 'podcast', 'podcast', 'https://feeds.fireside.fm/sv101/rss', 'https://sv101.fireside.fm'),
  ('Lex Fridman Podcast', 'podcast', 'podcast', 'https://lexfridman.com/feed/podcast/', 'https://lexfridman.com/podcast/'),
  ('Latent Space', 'podcast', 'podcast', 'https://www.latent.space/feed', 'https://www.latent.space/podcast'),
  ('美团技术团队', 'wechat', 'tech_feed', null, 'https://tech.meituan.com'),
  ('腾讯技术工程', 'wechat', 'tech_feed', null, null),
  ('阿里云开发者', 'wechat', 'tech_feed', null, null),
  ('字节跳动技术团队', 'wechat', 'tech_feed', null, null)
on conflict (name, source_type) do nothing;

update public.sources
set
  name = 'GitHub AI & ML',
  category = 'ai',
  feed_url = 'https://github.blog/ai-and-ml/feed/',
  homepage_url = 'https://github.blog/ai-and-ml/'
where name in ('GitHub Blog', 'GitHub AI & ML') and source_type = 'rss';
