-- ============================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
-- Sistema de Gestión de Anticonceptivos para CAPS
-- Ejecutar este script en Supabase SQL Editor
-- ============================================

-- ============================================
-- PARTE 1: LIMPIEZA (Ejecutar primero si hay tablas existentes)
-- ============================================

-- Eliminar políticas existentes primero
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Eliminar triggers existentes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_caps_updated_at ON public.caps;
DROP TRIGGER IF EXISTS update_tipos_anticonceptivos_updated_at ON public.tipos_anticonceptivos;
DROP TRIGGER IF EXISTS update_pacientes_updated_at ON public.pacientes;

-- Eliminar funciones existentes
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;

-- Eliminar tablas existentes (en orden inverso de dependencias)
DROP TABLE IF EXISTS registros_anticonceptivos CASCADE;
DROP TABLE IF EXISTS pacientes CASCADE;
DROP TABLE IF EXISTS tipos_anticonceptivos CASCADE;
DROP TABLE IF EXISTS caps CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Eliminar tipos existentes
DROP TYPE IF EXISTS user_role CASCADE;

-- ============================================
-- PARTE 2: CREAR TIPOS Y TABLAS
-- ============================================

-- Crear tipo de rol
CREATE TYPE user_role AS ENUM ('admin', 'cap_user');

-- Crear tabla de perfiles de usuario
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'cap_user',
  cap_number INTEGER CHECK (cap_number >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear tabla de CAPs (Centros de Atención Primaria)
-- Incluye dirección y nombre del responsable
CREATE TABLE caps (
  id SERIAL PRIMARY KEY,
  numero INTEGER UNIQUE NOT NULL CHECK (numero >= 1),
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  responsable_nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear tabla de tipos de anticonceptivos
CREATE TABLE tipos_anticonceptivos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  marca TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear tabla de pacientes
CREATE TABLE pacientes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT NOT NULL UNIQUE,
  edad INTEGER NOT NULL CHECK (edad > 0 AND edad < 150),
  cap_id INTEGER REFERENCES caps(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear tabla de registros de anticonceptivos entregados
CREATE TABLE registros_anticonceptivos (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo_anticonceptivo_id INTEGER REFERENCES tipos_anticonceptivos(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  fecha_entrega DATE NOT NULL DEFAULT CURRENT_DATE,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  anio INTEGER NOT NULL CHECK (anio >= 2024),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- PARTE 3: CREAR FUNCIONES
-- ============================================

-- Función helper para verificar rol de usuario (evita recursión en políticas)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Función para crear perfil automáticamente cuando se registra un usuario
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

-- ============================================
-- PARTE 4: HABILITAR RLS Y CREAR POLÍTICAS
-- ============================================

-- Habilitar Row Level Security en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_anticonceptivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_anticonceptivos ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
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
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- Políticas para caps
CREATE POLICY "Authenticated users can view caps"
ON public.caps
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert caps"
ON public.caps
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update caps"
ON public.caps
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete caps"
ON public.caps
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'admin');

-- Políticas para tipos_anticonceptivos
CREATE POLICY "Authenticated users can view tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'admin');

-- Políticas para pacientes
CREATE POLICY "Users can view pacientes by CAP"
ON public.pacientes
FOR SELECT
USING (
  public.get_user_role(auth.uid()) = 'admin' 
  OR (
    public.get_user_role(auth.uid()) = 'cap_user' 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.caps c ON c.numero = p.cap_number
      WHERE p.id = auth.uid() AND c.id = pacientes.cap_id
    )
  )
);

CREATE POLICY "Users can insert pacientes by CAP"
ON public.pacientes
FOR INSERT
WITH CHECK (
  public.get_user_role(auth.uid()) = 'admin' 
  OR (
    public.get_user_role(auth.uid()) = 'cap_user' 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.caps c ON c.numero = p.cap_number
      WHERE p.id = auth.uid() AND c.id = pacientes.cap_id
    )
  )
);

CREATE POLICY "Users can update pacientes by CAP"
ON public.pacientes
FOR UPDATE
USING (
  public.get_user_role(auth.uid()) = 'admin' 
  OR (
    public.get_user_role(auth.uid()) = 'cap_user' 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.caps c ON c.numero = p.cap_number
      WHERE p.id = auth.uid() AND c.id = pacientes.cap_id
    )
  )
)
WITH CHECK (
  public.get_user_role(auth.uid()) = 'admin' 
  OR (
    public.get_user_role(auth.uid()) = 'cap_user' 
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.caps c ON c.numero = p.cap_number
      WHERE p.id = auth.uid() AND c.id = pacientes.cap_id
    )
  )
);

CREATE POLICY "Admins can delete pacientes"
ON public.pacientes
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'admin');

-- Políticas para registros_anticonceptivos
CREATE POLICY "Users can view registros by CAP"
ON public.registros_anticonceptivos
FOR SELECT
USING (
  public.get_user_role(auth.uid()) = 'admin' 
  OR (
    public.get_user_role(auth.uid()) = 'cap_user' 
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      JOIN public.caps c ON c.id = p.cap_id
      JOIN public.profiles prof ON prof.cap_number = c.numero
      WHERE prof.id = auth.uid() AND p.id = registros_anticonceptivos.paciente_id
    )
  )
);

CREATE POLICY "Users can insert registros by CAP"
ON public.registros_anticonceptivos
FOR INSERT
WITH CHECK (
  public.get_user_role(auth.uid()) = 'admin' 
  OR (
    public.get_user_role(auth.uid()) = 'cap_user' 
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      JOIN public.caps c ON c.id = p.cap_id
      JOIN public.profiles prof ON prof.cap_number = c.numero
      WHERE prof.id = auth.uid() AND p.id = registros_anticonceptivos.paciente_id
    )
  )
);

CREATE POLICY "Users can update registros by CAP"
ON public.registros_anticonceptivos
FOR UPDATE
USING (
  public.get_user_role(auth.uid()) = 'admin' 
  OR (
    public.get_user_role(auth.uid()) = 'cap_user' 
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      JOIN public.caps c ON c.id = p.cap_id
      JOIN public.profiles prof ON prof.cap_number = c.numero
      WHERE prof.id = auth.uid() AND p.id = registros_anticonceptivos.paciente_id
    )
  )
)
WITH CHECK (
  public.get_user_role(auth.uid()) = 'admin' 
  OR (
    public.get_user_role(auth.uid()) = 'cap_user' 
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      JOIN public.caps c ON c.id = p.cap_id
      JOIN public.profiles prof ON prof.cap_number = c.numero
      WHERE prof.id = auth.uid() AND p.id = registros_anticonceptivos.paciente_id
    )
  )
);

CREATE POLICY "Admins can delete registros"
ON public.registros_anticonceptivos
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================
-- PARTE 5: CREAR TRIGGERS
-- ============================================

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_caps_updated_at
  BEFORE UPDATE ON public.caps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tipos_anticonceptivos_updated_at
  BEFORE UPDATE ON public.tipos_anticonceptivos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pacientes_updated_at
  BEFORE UPDATE ON public.pacientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para crear perfil automáticamente (requiere permisos especiales)
-- Si este trigger falla, puedes crearlo manualmente desde la interfaz de Supabase
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PARTE 6: CREAR ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_cap_number ON public.profiles(cap_number);
CREATE INDEX IF NOT EXISTS idx_caps_numero ON public.caps(numero);
CREATE INDEX IF NOT EXISTS idx_pacientes_cap_id ON public.pacientes(cap_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_dni ON public.pacientes(dni);
CREATE INDEX IF NOT EXISTS idx_registros_paciente_id ON public.registros_anticonceptivos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_registros_tipo_anticonceptivo_id ON public.registros_anticonceptivos(tipo_anticonceptivo_id);
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON public.registros_anticonceptivos(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_registros_mes_anio ON public.registros_anticonceptivos(mes, anio);
CREATE INDEX IF NOT EXISTS idx_registros_created_by ON public.registros_anticonceptivos(created_by);

-- ============================================
-- PARTE 7: INSERTAR DATOS INICIALES
-- ============================================

-- Insertar tipos de anticonceptivos comunes
INSERT INTO public.tipos_anticonceptivos (nombre, marca, descripcion) VALUES
  ('Píldora Combinada', 'Genérico', '21 o 28 comprimidos'),
  ('Píldora de Progestina', 'Genérico', 'Solo progestágeno'),
  ('Inyectable Mensual', 'Mesigyna', 'Inyección intramuscular'),
  ('Inyectable Trimestral', 'Depo-Provera', 'Cada 3 meses'),
  ('DIU de Cobre', 'T de Cobre', 'Dispositivo intrauterino'),
  ('DIU Hormonal', 'Mirena', 'Sistema intrauterino'),
  ('Implante Subdérmico', 'Implanon', 'Duración 3 años'),
  ('Preservativo', 'Genérico', 'Barrera'),
  ('Anillo Vaginal', 'NuvaRing', 'Mensual'),
  ('Parche Anticonceptivo', 'Evra', 'Semanal')
ON CONFLICT DO NOTHING;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- 
-- PRÓXIMOS PASOS:
-- 1. Crear el usuario administrador desde Supabase Auth
-- 2. Actualizar el perfil del administrador para asignar role = 'admin':
--    UPDATE public.profiles SET role = 'admin' WHERE email = 'tu-email@admin.com';
-- 3. Crear los CAPs desde la interfaz de administración de la aplicación
--    o ejecutar el script adicional para crear CAPs de ejemplo
-- ============================================
