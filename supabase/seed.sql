-- ==========================================
-- SCRIPT DE SEMILLA (SEED DATA) PARA SUPABASE
-- Ejecutar en el SQL Editor después de correr la migración inicial
-- ==========================================

-- 1. Insertar Inquilino (Tenant)
-- Debe coincidir con el tenantId de las credenciales de prueba en NextAuth
INSERT INTO tenants (id, name, subdomain, branding_color)
VALUES (
    '55555555-5555-5555-5555-555555555555',
    'Aura Estética',
    'aura-estetica',
    '#FBBF24'
) ON CONFLICT (id) DO NOTHING;

-- 2. Insertar Sucursales (Branches)
INSERT INTO branches (id, tenant_id, name, address, timezone)
VALUES 
(
    '10101010-1010-1010-1010-101010101010',
    '55555555-5555-5555-5555-555555555555',
    'Vibra',
    'Calle de la Moda 456, Local 1',
    'America/Argentina/Buenos_Aires'
),
(
    '20202020-2020-2020-2020-202020202020',
    '55555555-5555-5555-5555-555555555555',
    'Antonella Skin Studio',
    'Av. de la Salud 789, Local 2',
    'America/Argentina/Buenos_Aires'
) ON CONFLICT (id) DO NOTHING;

-- 3. Insertar Usuarios (Users)
-- Estos IDs coinciden con los usuarios mockeados en src/auth.ts para el login
INSERT INTO users (id, tenant_id, email, name, role)
VALUES
(
    '11111111-1111-1111-1111-111111111111',
    '55555555-5555-5555-5555-555555555555',
    'admin@aura.com',
    'Admin Figaro',
    'admin'
),
(
    '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555',
    'staff@aura.com',
    'Juan Barbero',
    'staff'
),
(
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    'ana@aura.com',
    'Ana Esteticista',
    'staff'
) ON CONFLICT (id) DO NOTHING;

-- 4. Insertar Profesionales (Staff)
INSERT INTO staff (id, tenant_id, branch_id, user_id, name, email, phone, is_active)
VALUES
(
    '33333333-3333-3333-3333-333333333333', -- Juan
    '55555555-5555-5555-5555-555555555555',
    '10101010-1010-1010-1010-101010101010', -- Sucursal Vibra
    '22222222-2222-2222-2222-222222222222',
    'Juan Barbero',
    'staff@aura.com',
    '1122334455',
    true
),
(
    '44444444-4444-4444-4444-444444444444', -- Ana
    '55555555-5555-5555-5555-555555555555',
    '20202020-2020-2020-2020-202020202020', -- Sucursal Antonella Skin Studio
    '44444444-4444-4444-4444-444444444444',
    'Ana Esteticista',
    'ana@aura.com',
    '2233445566',
    true
) ON CONFLICT (id) DO NOTHING;

-- 5. Insertar Servicios (Services)
INSERT INTO services (id, tenant_id, name, description, price, duration_minutes, buffer_time_minutes, is_active)
VALUES
(
    '50505050-5050-5050-5050-505050505050',
    '55555555-5555-5555-5555-555555555555',
    'Corte de Cabello y Barba',
    'Corte clásico, lavado, perfilado de barba y toalla caliente.',
    25.00,
    45,
    15,
    true
),
(
    '60606060-6060-6060-6060-606060606060',
    '55555555-5555-5555-5555-555555555555',
    'Tratamiento Facial Exfoliante',
    'Limpieza profunda, exfoliación de células muertas y mascarilla nutritiva.',
    40.00,
    60,
    15,
    true
) ON CONFLICT (id) DO NOTHING;

-- 6. Relacionar Profesionales con Servicios (staff_services)
INSERT INTO staff_services (staff_id, service_id)
VALUES
('33333333-3333-3333-3333-333333333333', '50505050-5050-5050-5050-505050505050'), -- Juan -> Corte
('44444444-4444-4444-4444-444444444444', '60606060-6060-6060-6060-606060606060')  -- Ana -> Facial
ON CONFLICT DO NOTHING;

-- 7. Insertar Horarios Laborales Semanales por Defecto (Lunes a Viernes de 09:00 a 18:00)
-- Para Juan Barbero (Sucursal 1)
INSERT INTO work_hours (staff_id, day_of_week, start_time, end_time, is_active)
VALUES
('33333333-3333-3333-3333-333333333333', 1, '09:00:00', '18:00:00', true),
('33333333-3333-3333-3333-333333333333', 2, '09:00:00', '18:00:00', true),
('33333333-3333-3333-3333-333333333333', 3, '09:00:00', '18:00:00', true),
('33333333-3333-3333-3333-333333333333', 4, '09:00:00', '18:00:00', true),
('33333333-3333-3333-3333-333333333333', 5, '09:00:00', '18:00:00', true),
('33333333-3333-3333-3333-333333333333', 6, '09:00:00', '18:00:00', false),
('33333333-3333-3333-3333-333333333333', 0, '09:00:00', '18:00:00', false)
ON CONFLICT (staff_id, day_of_week) DO NOTHING;

-- Para Ana Esteticista (Sucursal 2)
INSERT INTO work_hours (staff_id, day_of_week, start_time, end_time, is_active)
VALUES
('44444444-4444-4444-4444-444444444444', 1, '09:00:00', '18:00:00', true),
('44444444-4444-4444-4444-444444444444', 2, '09:00:00', '18:00:00', true),
('44444444-4444-4444-4444-444444444444', 3, '09:00:00', '18:00:00', true),
('44444444-4444-4444-4444-444444444444', 4, '09:00:00', '18:00:00', true),
('44444444-4444-4444-4444-444444444444', 5, '09:00:00', '18:00:00', true),
('44444444-4444-4444-4444-444444444444', 6, '09:00:00', '18:00:00', false),
('44444444-4444-4444-4444-444444444444', 0, '09:00:00', '18:00:00', false)
ON CONFLICT (staff_id, day_of_week) DO NOTHING;
