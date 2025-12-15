-- ============================================
-- SCRIPT PARA CREAR ADMINISTRADOR DIRECTAMENTE
-- Ejecutar este script en Supabase SQL Editor
-- ============================================

-- Este script crea un usuario administrador directamente
-- Email: admin@caps.com
-- Password: Admin123!
-- 
-- IMPORTANTE: Después de ejecutar este script, cambia la contraseña
-- desde la aplicación o desde Supabase Dashboard

-- Crear el usuario en auth.users usando la función de Supabase
-- Nota: Esto requiere permisos de service_role, así que es mejor hacerlo desde el Dashboard
-- Pero aquí está el SQL para crear el perfil una vez que tengas el usuario

-- PASO 1: Primero crea el usuario desde Supabase Dashboard:
-- Authentication → Users → Add user → Create new user
-- Email: admin@caps.com
-- Password: Admin123!
-- Auto Confirm User: ✅ activado

-- PASO 2: Luego ejecuta esto para obtener el UUID del usuario:
-- SELECT id, email FROM auth.users WHERE email = 'admin@caps.com';

-- PASO 3: Reemplaza '[UUID_DEL_USUARIO]' con el UUID que obtuviste y ejecuta:
-- INSERT INTO public.profiles (id, email, role)
-- VALUES ('[UUID_DEL_USUARIO]', 'admin@caps.com', 'admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- O simplemente actualiza si el perfil ya existe:
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'admin@caps.com';

-- Verificar que se creó correctamente
SELECT id, email, role, cap_number, created_at 
FROM public.profiles 
WHERE email = 'admin@caps.com';

