-- tHEMEat (themeatsg.com) — public contact address (Jurong), not Seletar / synthetic pin.
-- Source: https://www.themeatsg.com/contact — 9 Chin Bee Drive, Level 4 Unit 6, Singapore 619860
-- Coords ~ building at that postal (Jurong industrial area).

UPDATE public.startups
SET
  lat = 1.33642,
  lng = 103.71373,
  address_text = '9 Chin Bee Drive, Level 4 Unit 6, Singapore 619860',
  location_source = 'manual'
WHERE
  LOWER(COALESCE(website, '')) LIKE '%themeatsg%'
  OR LOWER(COALESCE(slug, '')) LIKE '%themeat%'
  OR REPLACE(LOWER(TRIM(COALESCE(name, ''))), ' ', '') LIKE '%themeatsg%';

notify pgrst, 'reload schema';
