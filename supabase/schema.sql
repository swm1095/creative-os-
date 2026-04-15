-- ============================================================
-- CreativeOS — Supabase Database Schema
-- Run this in your Supabase project: SQL Editor → New query
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ── BRANDS ──────────────────────────────────────────────────
create table public.brands (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  url             text,
  color           text default '#2B4EFF',
  brand_colors    jsonb,      -- array of hex strings
  brand_fonts     jsonb,      -- array of font name strings
  tone_notes      text,       -- brand tone & style description
  brand_guidelines_url text,
  logo_url        text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── CREATIVES ────────────────────────────────────────────────
create table public.creatives (
  id              uuid default uuid_generate_v4() primary key,
  brand_id        uuid references public.brands(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade not null,
  title           text not null,
  concept         text,
  persona         text,
  angle           text,
  image_url       text,
  image_1x1_url   text,
  image_4x5_url   text,
  image_9x16_url  text,
  format          text default '1x1',   -- '1x1', '4x5', '9x16'
  generator       text default 'ideogram', -- 'ideogram', 'fal'
  qc_spelling     text default 'pending',  -- 'pass', 'fail', 'warning', 'pending'
  qc_brand        text default 'pending',
  qc_claims       text default 'pending',
  qc_notes        jsonb,                -- array of QCNote objects
  created_at      timestamptz default now()
);

-- ── PERSONAS ─────────────────────────────────────────────────
create table public.personas (
  id              uuid default uuid_generate_v4() primary key,
  brand_id        uuid references public.brands(id) on delete cascade not null,
  name            text not null,
  angle           text,
  hook            text,
  theme           text,
  source          text default 'manual',  -- 'manual', 'sheets'
  created_at      timestamptz default now()
);

-- ── JOBS ─────────────────────────────────────────────────────
create table public.jobs (
  id              uuid default uuid_generate_v4() primary key,
  brand_id        uuid references public.brands(id) on delete cascade not null,
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  status          text default 'queued',   -- 'queued', 'running', 'done', 'error'
  progress        integer default 0,
  total           integer default 1,
  detail          text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table public.brands    enable row level security;
alter table public.creatives enable row level security;
alter table public.personas  enable row level security;
alter table public.jobs      enable row level security;

-- Brands: users can only see/modify their own brands
create policy "Users manage own brands" on public.brands
  for all using (auth.uid() = user_id);

-- Creatives: users can only see/modify their own creatives
create policy "Users manage own creatives" on public.creatives
  for all using (auth.uid() = user_id);

-- Personas: users can manage personas for their brands
create policy "Users manage own personas" on public.personas
  for all using (
    brand_id in (select id from public.brands where user_id = auth.uid())
  );

-- Jobs: users can manage their own jobs
create policy "Users manage own jobs" on public.jobs
  for all using (auth.uid() = user_id);

-- ── STORAGE BUCKET ───────────────────────────────────────────
-- Run this in Supabase Dashboard: Storage → New bucket
-- Bucket name: brand-assets
-- Public: true
-- Or run via SQL:
insert into storage.buckets (id, name, public)
  values ('brand-assets', 'brand-assets', true)
  on conflict do nothing;

create policy "Authenticated users can upload brand assets"
  on storage.objects for insert
  with check (auth.role() = 'authenticated' and bucket_id = 'brand-assets');

create policy "Brand assets are publicly readable"
  on storage.objects for select
  using (bucket_id = 'brand-assets');

create policy "Users can delete own brand assets"
  on storage.objects for delete
  using (auth.role() = 'authenticated' and bucket_id = 'brand-assets');

-- ── INDEXES ──────────────────────────────────────────────────
create index idx_brands_user_id      on public.brands(user_id);
create index idx_creatives_brand_id  on public.creatives(brand_id);
create index idx_creatives_user_id   on public.creatives(user_id);
create index idx_creatives_created   on public.creatives(created_at desc);
create index idx_jobs_brand_id       on public.jobs(brand_id);
create index idx_jobs_status         on public.jobs(status);
