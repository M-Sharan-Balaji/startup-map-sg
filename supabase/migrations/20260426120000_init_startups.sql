-- Run this in the Supabase SQL editor (or via Supabase CLI) for project https://<ref>.supabase.co

create table if not exists public.store_meta (
  id int primary key check (id = 1) default 1,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.store_meta (id, version) values (1, 1)
on conflict (id) do nothing;

create table if not exists public.startups (
  id text primary key,
  name text not null,
  slug text not null,
  description text not null,
  website text not null,
  stage text not null,
  sectors jsonb not null default '[]'::jsonb,
  lat double precision not null,
  lng double precision not null,
  source_url text,
  last_enriched_at timestamptz,
  linkedin_url text,
  logo_url text,
  hiring boolean
);

-- Service role (used by this Next.js server) bypasses RLS; no policies for anonymous/public by default
alter table public.store_meta enable row level security;
alter table public.startups enable row level security;

-- Refresh PostgREST schema cache (fixes "not in the schema cache" right after first deploy)
notify pgrst, 'reload schema';
