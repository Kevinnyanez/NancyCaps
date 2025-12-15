-- ============================================
-- SCRIPT COMPLETO PARA CREAR ADMINISTRADOR
-- Ejecutar en Supabase SQL Editor
-- ============================================
--
-- Este script crea el usuario administrador con:
-- Email: admin@caps.com
-- Password: Admin123!
-- Role: admin
--
-- IMPORTANTE: 
-- 1. Primero crea el usuario desde Supabase Dashboard:
--    Authentication → Users → Add user → Create new user
--    - Email: admin@caps.com
--    - Password: Admin123!
--    - Auto Confirm User: ✅ activado
--    - Click "Create user"
--
-- 2. Luego ejecuta este script completo:
-- ============================================

-- Obtener el UUID del usuario recién creado
DO $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Buscar el usuario en auth.users
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = 'admin@caps.com'
  LIMIT 1;

  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'Usuario admin@caps.com no encontrado en auth.users. Por favor créalo primero desde Supabase Dashboard.';
  END IF;

  -- Crear o actualizar el perfil con rol admin
  INSERT INTO public.profiles (id, email, role)
  VALUES (user_uuid, 'admin@caps.com', 'admin')
  ON CONFLICT (id) 
  DO UPDATE SET 
    role = 'admin',
    email = 'admin@caps.com';

  RAISE NOTICE 'Usuario administrador creado/actualizado correctamente con UUID: %', user_uuid;
END $$;

-- Verificar que se creó correctamente
SELECT 
  id,
  email,
  role,
  cap_number,
  created_at
FROM public.profiles
WHERE email = 'admin@caps.com';

-- ============================================
-- CREDENCIALES DEL ADMINISTRADOR:
-- Email: admin@caps.com
-- Password: Admin123!
-- ============================================

