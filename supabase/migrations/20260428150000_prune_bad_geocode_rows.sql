-- Prune known bad test rows (wrong Johor / bad geocoding). Preview first:
--   SELECT id, name, slug, website FROM public.startups
--   WHERE LOWER(COALESCE(website,'')) LIKE '%stickem%'
--      OR LOWER(COALESCE(name,'')) IN ('robot company', 'the robot company')
--      OR LOWER(COALESCE(slug,'')) LIKE 'stick-em%' OR LOWER(COALESCE(slug,'')) LIKE 'robot-company%';

DELETE FROM public.startups
WHERE
  LOWER(COALESCE(website, '')) LIKE '%stickem%'
  OR LOWER(TRIM(COALESCE(name, ''))) IN ('robot company', 'the robot company')
  OR LOWER(COALESCE(slug, '')) LIKE 'stick-em%'
  OR LOWER(COALESCE(slug, '')) LIKE 'robot-company%';

notify pgrst, 'reload schema';
