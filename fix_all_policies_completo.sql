-- ============================================
-- SCRIPT COMPLETO PARA CORREGIR TODAS LAS POLÍTICAS RLS
-- Ejecutar en Supabase SQL Editor
-- ============================================
-- 
-- Este script corrige las políticas para:
-- 1. pacientes - permitir CRUD a usuarios CAP de su CAP
-- 2. registros_anticonceptivos - permitir crear registros a usuarios CAP
--
-- ============================================

-- ============================================
-- PARTE 1: POLÍTICAS DE PACIENTES
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

-- ============================================
-- PARTE 2: POLÍTICAS DE registros_anticonceptivos
-- ============================================

-- Eliminar todas las políticas existentes de registros_anticonceptivos
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'registros_anticonceptivos' AND schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.registros_anticonceptivos', r.policyname);
    END LOOP;
END $$;

-- SELECT: Usuarios CAP ven registros de pacientes de su CAP, admins ven todos
CREATE POLICY "registros_select"
ON public.registros_anticonceptivos
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
          SELECT 1 FROM public.pacientes pac
          JOIN public.caps c ON c.id = pac.cap_id
          WHERE c.numero = p.cap_number 
          AND pac.id = registros_anticonceptivos.paciente_id
        )
      )
    )
  )
);

-- INSERT: Usuarios CAP pueden crear registros para pacientes de su CAP, admins para cualquier paciente
CREATE POLICY "registros_insert"
ON public.registros_anticonceptivos
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
          SELECT 1 FROM public.pacientes pac
          JOIN public.caps c ON c.id = pac.cap_id
          WHERE c.numero = p.cap_number 
          AND pac.id = registros_anticonceptivos.paciente_id
        )
      )
    )
  )
);

-- UPDATE: Usuarios CAP pueden actualizar registros de pacientes de su CAP, admins cualquier registro
CREATE POLICY "registros_update"
ON public.registros_anticonceptivos
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
          SELECT 1 FROM public.pacientes pac
          JOIN public.caps c ON c.id = pac.cap_id
          WHERE c.numero = p.cap_number 
          AND pac.id = registros_anticonceptivos.paciente_id
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
          SELECT 1 FROM public.pacientes pac
          JOIN public.caps c ON c.id = pac.cap_id
          WHERE c.numero = p.cap_number 
          AND pac.id = registros_anticonceptivos.paciente_id
        )
      )
    )
  )
);

-- DELETE: Solo admins pueden eliminar registros
CREATE POLICY "registros_delete"
ON public.registros_anticonceptivos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar políticas de pacientes
SELECT 
  'pacientes' as tabla,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'pacientes'
ORDER BY cmd;

-- Verificar políticas de registros_anticonceptivos
SELECT 
  'registros_anticonceptivos' as tabla,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename = 'registros_anticonceptivos'
ORDER BY cmd;

