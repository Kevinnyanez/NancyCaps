-- Drop existing problematic policies
DROP POLICY IF EXISTS "Los admins pueden ver todos los perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

-- Create security definer function to check user role without recursion
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Create new policies using the security definer function
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin');

-- Update caps policies to use security definer function
DROP POLICY IF EXISTS "Todos los usuarios autenticados pueden ver CAPs" ON public.caps;
DROP POLICY IF EXISTS "Admins can insert caps" ON public.caps;
DROP POLICY IF EXISTS "Admins can update caps" ON public.caps;
DROP POLICY IF EXISTS "Admins can delete caps" ON public.caps;

CREATE POLICY "Authenticated users can view caps"
ON public.caps
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage caps insert"
ON public.caps
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can manage caps update"
ON public.caps
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can manage caps delete"
ON public.caps
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'admin');