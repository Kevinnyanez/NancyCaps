-- ============================================
-- SCRIPT PARA CREAR/ASIGNAR ADMINISTRADOR
-- ============================================
-- 
-- INSTRUCCIONES:
-- 1. Primero crea el usuario desde Supabase Dashboard:
--    Authentication → Users → Add user → Create new user
--    - Email: admin@caps.com (o el que prefieras)
--    - Password: [tu contraseña]
--    - Auto Confirm User: ✅ activado
--
-- 2. Luego ejecuta este script reemplazando el email:
-- ============================================

-- Reemplaza 'admin@caps.com' con el email que usaste para crear el usuario
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'admin@caps.com';

-- Verificar que se actualizó correctamente
SELECT id, email, role, cap_number, created_at 
FROM public.profiles 
WHERE email = 'admin@caps.com';

-- ============================================
-- Si el usuario no existe en profiles, créalo manualmente:
-- ============================================
-- Primero necesitas el UUID del usuario desde auth.users
-- SELECT id, email FROM auth.users WHERE email = 'admin@caps.com';
--
-- Luego inserta en profiles:
-- INSERT INTO public.profiles (id, email, role)
-- VALUES ('[UUID_DEL_USUARIO]', 'admin@caps.com', 'admin');

