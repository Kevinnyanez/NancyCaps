-- Script para resetear la contraseña de admin@caps.com
-- USO: Reemplaza el valor de NEW_PASSWORD más abajo y ejecútalo en el SQL Editor de Supabase
-- Requiere privilegios de administrador (service_role) para correr correctamente.

-- IMPORTANTE: Sustituye el valor de `newpass` en la variable dentro del bloque DO
-- Nota: El SQL Editor de Supabase no soporta comandos de psql como `\set`.
DO $$
DECLARE
  uid UUID;
  -- Cambia aquí la contraseña nueva antes de ejecutar el script
  newpass TEXT := 'Admin123!';
  has_admin_update BOOLEAN := FALSE;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'admin@caps.com' LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Usuario admin@caps.com no encontrado en auth.users';
  END IF;

  -- Verificar si la función admin_update_user existe en el schema auth
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'admin_update_user' AND n.nspname = 'auth'
  ) INTO has_admin_update;

  IF has_admin_update THEN
    -- Usar la función oficial si está disponible
    PERFORM auth.admin_update_user(uid, json_build_object('password', newpass)::json);
    RAISE NOTICE 'Contraseña actualizada mediante auth.admin_update_user para usuario %', uid;
  ELSE
    -- Fallback: usar pgcrypto para encriptar la contraseña y actualizar auth.users.encrypted_password
    -- Asegurarse de tener pgcrypto
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudo crear o verificar la extensión pgcrypto. Continúo de todas formas.';
    END;

    EXECUTE format('UPDATE auth.users SET encrypted_password = crypt(%L, gen_salt(''bf'')) WHERE id = %L', newpass, uid);
    RAISE NOTICE 'Contraseña actualizada mediante UPDATE en auth.users (pgcrypto). Usuario: %', uid;
  END IF;
END$$;

-- Nota: Después de ejecutar, intenta iniciar sesión con admin@caps.com y la nueva contraseña.
-- Si usas Supabase Hosted, lo preferible es cambiar contraseña desde el Dashboard o la Admin API.
