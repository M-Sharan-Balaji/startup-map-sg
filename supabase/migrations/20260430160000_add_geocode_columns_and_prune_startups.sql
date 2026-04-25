-- One-shot: geocode columns (fixes PostgREST "address_text not in schema cache") + remove noisy test rows.
-- Safe to re-run: IF NOT EXISTS columns; delete is idempotent.

alter table public.startups
  add column if not exists address_text text,
  add column if not exists location_source text;

-- Robot Company, Stick ’Em, tHEMEat / themeatsg (as requested for removal)
delete from public.startups
where
  lower(trim(coalesce(name, ''))) in ('robot company', 'the robot company')
  or lower(coalesce(website, '')) like '%stickem%'
  or lower(coalesce(website, '')) like '%themeatsg%'
  or lower(coalesce(slug, '')) like 'stick-em%'
  or lower(coalesce(slug, '')) like 'robot-company%'
  or lower(coalesce(slug, '')) like '%themeatsg%'
  or replace(lower(trim(coalesce(name, ''))), ' ', '') like '%themeatsg%';

notify pgrst, 'reload schema';
