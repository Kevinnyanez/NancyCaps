-- Allow all authenticated users to read basic profile info (needed for chat)
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
