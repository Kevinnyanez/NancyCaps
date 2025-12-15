-- ============================================
-- SCRIPT SIMPLIFICADO DE CONFIGURACIÓN
-- Si el script principal falla, intenta este
-- ============================================

-- Eliminar tablas existentes
DROP TABLE IF EXISTS registros_anticonceptivos CASCADE;
DROP TABLE IF EXISTS pacientes CASCADE;
DROP TABLE IF EXISTS tipos_anticonceptivos CASCADE;
DROP TABLE IF EXISTS caps CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Crear tipo
CREATE TYPE user_role AS ENUM ('admin', 'cap_user');

-- Crear tablas
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'cap_user',
  cap_number INTEGER CHECK (cap_number >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE caps (
  id SERIAL PRIMARY KEY,
  numero INTEGER UNIQUE NOT NULL CHECK (numero >= 1),
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  responsable_nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tipos_anticonceptivos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  marca TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_anticonceptivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_anticonceptivos ENABLE ROW LEVEL SECURITY;

-- Función helper
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Políticas básicas (solo lectura para todos, sin restricciones complejas por ahora)
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update profiles"
ON public.profiles FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "All authenticated can view caps"
ON public.caps FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can view tipos"
ON public.tipos_anticonceptivos FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can view pacientes"
ON public.pacientes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can view registros"
ON public.registros_anticonceptivos FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insertar datos iniciales
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
  ('Parche Anticonceptivo', 'Evra', 'Semanal');

