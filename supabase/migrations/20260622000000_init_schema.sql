-- ==========================================
-- 01. HABILITAR EXTENSIONES REQUERIDAS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 02. DEFINICIÓN DE TIPOS PERSONALIZADOS (ENUMS)
-- ==========================================
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'receptionist', 'staff', 'customer');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');

-- ==========================================
-- 03. CREACIÓN DE TABLAS DE DOMINIO
-- ==========================================

-- A. Inquilinos (Tenants)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    branding_color VARCHAR(7) DEFAULT '#000000',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- B. Sucursales (Branches)
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    timezone VARCHAR(100) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- C. Usuarios (Users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- D. Servicios (Services)
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    buffer_time_minutes INT DEFAULT 0 CHECK (buffer_time_minutes >= 0),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- E. Profesionales (Staff)
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- F. Relación Staff - Servicios (staff_services)
CREATE TABLE staff_services (
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, service_id)
);

-- G. Horarios Laborales del Staff (work_hours)
CREATE TABLE work_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 6=Sábado
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    CONSTRAINT chk_hours_order CHECK (start_time < end_time),
    UNIQUE (staff_id, day_of_week) -- Un solo registro de horario laboral por profesional por día
);

-- H. Bloqueos de Agenda / Excepciones (time_blocks)
CREATE TABLE time_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(255),
    CONSTRAINT chk_block_order CHECK (start_time < end_time)
);

-- I. Clientes del Tenant (customers)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX idx_customers_tenant_phone ON customers(tenant_id, phone);

-- J. Reservas (bookings)
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status booking_status NOT NULL DEFAULT 'confirmed',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    price_charged DECIMAL(10,2) NOT NULL CHECK (price_charged >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_booking_order CHECK (start_time < end_time)
);

-- ==========================================
-- 04. RESTRICCIONES DE EXCLUSIÓN (CONCURRENCIA)
-- ==========================================

-- Restricción física para evitar double-booking del mismo profesional
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
  staff_id WITH =,
  tstzrange(start_time, end_time) WITH &&
) WHERE (status NOT IN ('cancelled', 'no_show'));

-- Evitar bloquear la misma franja de tiempo dos veces para el mismo profesional
ALTER TABLE time_blocks ADD CONSTRAINT no_overlapping_time_blocks
EXCLUDE USING gist (
  staff_id WITH =,
  tstzrange(start_time, end_time) WITH &&
);

-- ==========================================
-- 05. ÍNDICES DE RENDIMIENTO
-- ==========================================
CREATE INDEX idx_branches_tenant_id ON branches(tenant_id);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_services_tenant_id ON services(tenant_id);
CREATE INDEX idx_staff_tenant_branch ON staff(tenant_id, branch_id);
CREATE INDEX idx_work_hours_staff ON work_hours(staff_id);
CREATE INDEX idx_time_blocks_search ON time_blocks(staff_id, start_time, end_time);
CREATE INDEX idx_bookings_search ON bookings(tenant_id, branch_id, staff_id, start_time, end_time);

-- ==========================================
-- 06. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Nota: Para simplificar las políticas del MVP, asumimos una función helper de Postgres 
-- que extrae el `tenant_id` y el `role` desde el JWT personalizado enviado por Auth.js.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'tenantId', '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS VARCHAR AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'role', '')::VARCHAR;
$$ LANGUAGE sql STABLE;

-- POLÍTICAS PARA LA TABLA: tenants (Solo superadmin o coincidencia de ID)
CREATE POLICY tenant_all_policy ON tenants
    FOR ALL
    USING (current_user_role() = 'superadmin' OR id = current_tenant_id());

-- POLÍTICAS PARA LA TABLA: branches
CREATE POLICY branch_all_policy ON branches
    FOR ALL
    USING (current_user_role() = 'superadmin' OR tenant_id = current_tenant_id());

CREATE POLICY branch_read_policy ON branches
    FOR SELECT
    USING (true); -- Clientes públicos pueden ver las sucursales para reservar

-- POLÍTICAS PARA LA TABLA: users
CREATE POLICY user_all_policy ON users
    FOR ALL
    USING (current_user_role() = 'superadmin' OR tenant_id = current_tenant_id());

-- POLÍTICAS PARA LA TABLA: services (Clientes anónimos pueden verlos para reservar)
CREATE POLICY service_read_policy ON services
    FOR SELECT
    USING (true); -- Cualquiera puede ver los servicios disponibles

CREATE POLICY service_write_policy ON services
    FOR ALL
    USING (current_user_role() IN ('superadmin', 'admin') AND tenant_id = current_tenant_id());

-- POLÍTICAS PARA LA TABLA: staff (Público puede leerlos, admins modifican)
CREATE POLICY staff_read_policy ON staff
    FOR SELECT
    USING (true);

CREATE POLICY staff_write_policy ON staff
    FOR ALL
    USING (current_user_role() IN ('superadmin', 'admin') AND tenant_id = current_tenant_id());

-- POLÍTICAS PARA LA TABLA: staff_services (Público lee, admins modifican)
CREATE POLICY staff_services_read_policy ON staff_services
    FOR SELECT
    USING (true);

CREATE POLICY staff_services_write_policy ON staff_services
    FOR ALL
    USING (current_user_role() IN ('superadmin', 'admin'));

-- POLÍTICAS PARA LA TABLA: work_hours (Público lee, admins modifican)
CREATE POLICY work_hours_read_policy ON work_hours
    FOR SELECT
    USING (true);

CREATE POLICY work_hours_write_policy ON work_hours
    FOR ALL
    USING (current_user_role() IN ('superadmin', 'admin'));

-- POLÍTICAS PARA LA TABLA: time_blocks (Público lee para ver disponibilidad, admins/staff modifican)
CREATE POLICY time_blocks_read_policy ON time_blocks
    FOR SELECT
    USING (true);

CREATE POLICY time_blocks_write_policy ON time_blocks
    FOR ALL
    USING (current_user_role() IN ('superadmin', 'admin', 'staff'));

-- POLÍTICAS PARA LA TABLA: customers (Admins/Recep/Staff acceden a clientes de su tenant)
CREATE POLICY customer_all_policy ON customers
    FOR ALL
    USING (current_user_role() IN ('superadmin', 'admin', 'receptionist', 'staff') AND tenant_id = current_tenant_id());

-- Permitir a clientes anónimos registrarse a sí mismos durante la reserva pública
CREATE POLICY customer_anon_insert_policy ON customers
    FOR INSERT
    WITH CHECK (true);

-- POLÍTICAS PARA LA TABLA: bookings (Admins/Recep/Staff acceden a todas las del tenant)
CREATE POLICY booking_all_policy ON bookings
    FOR ALL
    USING (current_user_role() IN ('superadmin', 'admin', 'receptionist', 'staff') AND tenant_id = current_tenant_id());

-- Permitir a clientes anónimos insertar reservas públicas y ver sus propios registros
CREATE POLICY booking_anon_insert_policy ON bookings
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY booking_anon_read_policy ON bookings
    FOR SELECT
    USING (true); -- Permitido leer para verificar disponibilidad o detalles públicos del turno
