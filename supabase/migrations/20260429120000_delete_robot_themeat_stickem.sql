-- Remove test / bad rows: The Robot Company, Stick ’Em, The Meat (themeatsg).
-- Preview: SELECT id, name, slug, website FROM public.startups WHERE
--   (same predicates as below);

DELETE FROM public.startups
WHERE
  LOWER(TRIM(COALESCE(name, ''))) IN ('robot company', 'the robot company')
  OR LOWER(COALESCE(website, '')) LIKE '%stickem%'
  OR LOWER(COALESCE(website, '')) LIKE '%themeatsg%'
  OR LOWER(COALESCE(slug, '')) LIKE 'stick-em%'
  OR LOWER(COALESCE(slug, '')) LIKE 'robot-company%'
  OR LOWER(COALESCE(slug, '')) LIKE '%themeatsg%'
  OR REPLACE(LOWER(TRIM(COALESCE(name, ''))), ' ', '') LIKE '%themeatsg%';

notify pgrst, 'reload schema';
