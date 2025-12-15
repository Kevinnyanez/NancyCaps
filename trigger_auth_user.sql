-- ============================================
-- SCRIPT PARA CREAR TRIGGER EN auth.users
-- Ejecutar este script DESPUÉS del script principal
-- Si tienes permisos de administrador en Supabase
-- ============================================

-- Función para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'cap_user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Crear trigger (puede requerir permisos especiales)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

