-- Optional resolved address and geocoding source (Nominatim, OneMap, or synthetic spread).
alter table public.startups
  add column if not exists address_text text,
  add column if not exists location_source text;

notify pgrst, 'reload schema';
