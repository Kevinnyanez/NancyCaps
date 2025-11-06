-- Crear enum para roles de usuario
CREATE TYPE user_role AS ENUM ('admin', 'cap_user');

-- Tabla de perfiles de usuario
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'cap_user',
  cap_number INTEGER CHECK (cap_number >= 1 AND cap_number <= 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Los usuarios pueden ver su propio perfil"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Los admins pueden ver todos los perfiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tabla de CAPs (Centros de Atención Primaria)
CREATE TABLE caps (
  id SERIAL PRIMARY KEY,
  numero INTEGER UNIQUE NOT NULL CHECK (numero >= 1 AND numero <= 6),
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE caps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos los usuarios autenticados pueden ver CAPs"
  ON caps FOR SELECT
  TO authenticated
  USING (true);

-- Insertar los 6 CAPs
INSERT INTO caps (numero, nombre) VALUES
  (1, 'CAP 1'),
  (2, 'CAP 2'),
  (3, 'CAP 3'),
  (4, 'CAP 4'),
  (5, 'CAP 5'),
  (6, 'CAP 6');

-- Tabla de tipos de anticonceptivos
CREATE TABLE tipos_anticonceptivos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  marca TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tipos_anticonceptivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos los usuarios autenticados pueden ver tipos de anticonceptivos"
  ON tipos_anticonceptivos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo admins pueden crear tipos de anticonceptivos"
  ON tipos_anticonceptivos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Solo admins pueden actualizar tipos de anticonceptivos"
  ON tipos_anticonceptivos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Solo admins pueden eliminar tipos de anticonceptivos"
  ON tipos_anticonceptivos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insertar algunos tipos de anticonceptivos comunes
INSERT INTO tipos_anticonceptivos (nombre, marca, descripcion) VALUES
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

-- Tabla de pacientes
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

ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;

-- Los usuarios CAP solo ven pacientes de su CAP
CREATE POLICY "Usuarios CAP ven pacientes de su CAP"
  ON pacientes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND (
        role = 'admin' 
        OR (role = 'cap_user' AND cap_number = (SELECT numero FROM caps WHERE caps.id = pacientes.cap_id))
      )
    )
  );

CREATE POLICY "Usuarios CAP pueden crear pacientes en su CAP"
  ON pacientes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND (
        role = 'admin' 
        OR (role = 'cap_user' AND cap_number = (SELECT numero FROM caps WHERE caps.id = pacientes.cap_id))
      )
    )
  );

CREATE POLICY "Usuarios CAP pueden actualizar pacientes de su CAP"
  ON pacientes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND (
        role = 'admin' 
        OR (role = 'cap_user' AND cap_number = (SELECT numero FROM caps WHERE caps.id = pacientes.cap_id))
      )
    )
  );

CREATE POLICY "Solo admins pueden eliminar pacientes"
  ON pacientes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tabla de registros de anticonceptivos entregados
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

ALTER TABLE registros_anticonceptivos ENABLE ROW LEVEL SECURITY;

-- Los usuarios CAP solo ven registros de pacientes de su CAP
CREATE POLICY "Ver registros según CAP"
  ON registros_anticonceptivos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      JOIN profiles prof ON (
        prof.id = auth.uid() 
        AND (
          prof.role = 'admin' 
          OR (prof.role = 'cap_user' AND prof.cap_number = (SELECT numero FROM caps WHERE caps.id = p.cap_id))
        )
      )
      WHERE p.id = registros_anticonceptivos.paciente_id
    )
  );

CREATE POLICY "Crear registros según CAP"
  ON registros_anticonceptivos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pacientes p
      JOIN profiles prof ON (
        prof.id = auth.uid() 
        AND (
          prof.role = 'admin' 
          OR (prof.role = 'cap_user' AND prof.cap_number = (SELECT numero FROM caps WHERE caps.id = p.cap_id))
        )
      )
      WHERE p.id = registros_anticonceptivos.paciente_id
    )
  );

CREATE POLICY "Actualizar registros según CAP"
  ON registros_anticonceptivos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      JOIN profiles prof ON (
        prof.id = auth.uid() 
        AND (
          prof.role = 'admin' 
          OR (prof.role = 'cap_user' AND prof.cap_number = (SELECT numero FROM caps WHERE caps.id = p.cap_id))
        )
      )
      WHERE p.id = registros_anticonceptivos.paciente_id
    )
  );

CREATE POLICY "Solo admins pueden eliminar registros"
  ON registros_anticonceptivos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger para actualizar updated_at en pacientes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pacientes_updated_at
  BEFORE UPDATE ON pacientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para crear perfil cuando se registra un usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'cap_user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Índices para mejorar performance
CREATE INDEX idx_pacientes_cap_id ON pacientes(cap_id);
CREATE INDEX idx_pacientes_dni ON pacientes(dni);
CREATE INDEX idx_registros_paciente_id ON registros_anticonceptivos(paciente_id);
CREATE INDEX idx_registros_fecha ON registros_anticonceptivos(fecha_entrega);
CREATE INDEX idx_registros_mes_anio ON registros_anticonceptivos(mes, anio);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_cap_number ON profiles(cap_number);