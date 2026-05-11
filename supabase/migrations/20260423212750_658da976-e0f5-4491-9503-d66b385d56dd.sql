-- Replace overly-restrictive SELECT on profiles. Avatars and names are
-- already shared inside groups/DMs in-app; this lets the client prefetch
-- member profile cards instead of fetching one-by-one.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);