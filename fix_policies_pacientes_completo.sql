-- ============================================
-- SCRIPT PARA CORREGIR POLÍTICAS DE PACIENTES
-- Ejecutar en Supabase SQL Editor
-- ============================================
-- 
-- Este script permite que los usuarios CAP puedan:
-- - Ver pacientes de su CAP
-- - Crear pacientes en su CAP
-- - Actualizar pacientes de su CAP
-- - Eliminar pacientes de su CAP
--
-- Los administradores pueden hacer todo en todos los CAPs
-- ============================================

-- Eliminar todas las políticas existentes de pacientes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'pacientes' AND schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.pacientes', r.policyname);
    END LOOP;
END $$;

-- SELECT: Usuarios CAP ven pacientes de su CAP, admins ven todos
CREATE POLICY "pacientes_select"
ON public.pacientes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND (
      p.role = 'admin' 
      OR (
        p.role = 'cap_user' 
        AND EXISTS (
          SELECT 1 FROM public.caps c
          WHERE c.numero = p.cap_number AND c.id = pacientes.cap_id
        )
      )
    )
  )
);

-- INSERT: Usuarios CAP pueden crear pacientes en su CAP, admins en cualquier CAP
CREATE POLICY "pacientes_insert"
ON public.pacientes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND (
      p.role = 'admin' 
      OR (
        p.role = 'cap_user' 
        AND EXISTS (
          SELECT 1 FROM public.caps c
          WHERE c.numero = p.cap_number AND c.id = pacientes.cap_id
        )
      )
    )
  )
);

-- UPDATE: Usuarios CAP pueden actualizar pacientes de su CAP, admins cualquier paciente
CREATE POLICY "pacientes_update"
ON public.pacientes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND (
      p.role = 'admin' 
      OR (
        p.role = 'cap_user' 
        AND EXISTS (
          SELECT 1 FROM public.caps c
          WHERE c.numero = p.cap_number AND c.id = pacientes.cap_id
        )
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND (
      p.role = 'admin' 
      OR (
        p.role = 'cap_user' 
        AND EXISTS (
          SELECT 1 FROM public.caps c
          WHERE c.numero = p.cap_number AND c.id = pacientes.cap_id
        )
      )
    )
  )
);

-- DELETE: Usuarios CAP pueden eliminar pacientes de su CAP, admins cualquier paciente
CREATE POLICY "pacientes_delete"
ON public.pacientes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND (
      p.role = 'admin' 
      OR (
        p.role = 'cap_user' 
        AND EXISTS (
          SELECT 1 FROM public.caps c
          WHERE c.numero = p.cap_number AND c.id = pacientes.cap_id
        )
      )
    )
  )
);

-- Verificar que se crearon correctamente
SELECT 
  policyname,
  cmd as operation,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'pacientes'
ORDER BY cmd;

