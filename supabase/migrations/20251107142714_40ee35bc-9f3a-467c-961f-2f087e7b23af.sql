-- Create trigger to auto-create profiles on signup (id, email, default role)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;

-- Allow admins to update profiles (needed for ManageUsers UI)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update profiles' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Admins can update profiles"
    ON public.profiles
    FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;

-- Allow admins to manage CAPs (create, edit, delete)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can insert caps' AND tablename = 'caps'
  ) THEN
    CREATE POLICY "Admins can insert caps"
    ON public.caps
    FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update caps' AND tablename = 'caps'
  ) THEN
    CREATE POLICY "Admins can update caps"
    ON public.caps
    FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete caps' AND tablename = 'caps'
  ) THEN
    CREATE POLICY "Admins can delete caps"
    ON public.caps
    FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;