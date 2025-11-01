-- ============================================================================
-- Test Data Seed for CRM_2.0 - 10-20 records per table
-- Generated: 2025-01-02
-- ============================================================================

-- Set search path
SET search_path TO crm, public;

-- ============================================================================
-- AUTH SCHEMA - Users and Roles
-- ============================================================================
\c crm postgres
SET search_path TO auth, public;

-- Clear existing test data (keeping original 5 users)
-- Roles are already populated

-- Insert additional test users (5 more for 10 total)
INSERT INTO auth.users (id, email, password_hash, enabled, created_at, updated_at) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'marina.client@example.com', '$2b$12$test_hash_1', true, NOW(), NOW()),
    ('550e8400-e29b-41d4-a716-446655440002', 'dmitry.seller@example.com', '$2b$12$test_hash_2', true, NOW(), NOW()),
    ('550e8400-e29b-41d4-a716-446655440003', 'svetlana.support@example.com', '$2b$12$test_hash_3', true, NOW(), NOW()),
    ('550e8400-e29b-41d4-a716-446655440004', 'boris.director@example.com', '$2b$12$test_hash_4', true, NOW(), NOW()),
    ('550e8400-e29b-41d4-a716-446655440005', 'natasha.analyst@example.com', '$2b$12$test_hash_5', true, NOW(), NOW()),
    ('550e8400-e29b-41d4-a716-446655440006', 'alexey.manager@example.com', '$2b$12$test_hash_6', true, NOW(), NOW()),
    ('550e8400-e29b-41d4-a716-446655440007', 'ekaterina.advisor@example.com', '$2b$12$test_hash_7', true, NOW(), NOW()),
    ('550e8400-e29b-41d4-a716-446655440008', 'vladimir.specialist@example.com', '$2b$12$test_hash_8', true, NOW(), NOW()),
    ('550e8400-e29b-41d4-a716-446655440009', 'irina.coordinator@example.com', '$2b$12$test_hash_9', true, NOW(), NOW()),
    ('550e8400-e29b-41d4-a716-44665544000a', 'mikhail.consultant@example.com', '$2b$12$test_hash_a', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Assign roles to new users
INSERT INTO auth.user_roles (user_id, role_id)
SELECT u.id, r.id FROM auth.users u
CROSS JOIN auth.roles r
WHERE u.email IN (
    'marina.client@example.com',
    'dmitry.seller@example.com',
    'svetlana.support@example.com',
    'boris.director@example.com',
    'natasha.analyst@example.com',
    'alexey.manager@example.com',
    'ekaterina.advisor@example.com',
    'vladimir.specialist@example.com',
    'irina.coordinator@example.com',
    'mikhail.consultant@example.com'
) AND r.name = 'ROLE_USER'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ============================================================================
-- CRM SCHEMA - Main Tables
-- ============================================================================
SET search_path TO crm, public;

-- Clear test data first
TRUNCATE TABLE crm.deal_journal CASCADE;
TRUNCATE TABLE crm.payments CASCADE;
TRUNCATE TABLE crm.payment_incomes CASCADE;
TRUNCATE TABLE crm.payment_expenses CASCADE;
TRUNCATE TABLE crm.policy_documents CASCADE;
TRUNCATE TABLE crm.policies CASCADE;
TRUNCATE TABLE crm.calculations CASCADE;
TRUNCATE TABLE crm.deals CASCADE;
TRUNCATE TABLE crm.clients CASCADE;

-- ============================================================================
-- CLIENTS (20 records)
-- ============================================================================
INSERT INTO crm.clients (id, owner_id, name, email, phone, status, is_deleted, created_at, updated_at) VALUES
    ('760e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'ООО Альфа Страхование', 'contact@alfa.ru', '+7 (495) 123-45-01', 'active', false, NOW() - INTERVAL '90 days', NOW() - INTERVAL '30 days'),
    ('760e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'АО БытТех', 'info@byttech.ru', '+7 (495) 234-56-02', 'active', false, NOW() - INTERVAL '75 days', NOW() - INTERVAL '20 days'),
    ('760e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'ООО ГеоМастер', 'contact@geomaster.ru', '+7 (812) 345-67-03', 'active', false, NOW() - INTERVAL '60 days', NOW() - INTERVAL '15 days'),
    ('760e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'ИП Сидоров И.П.', 'sidorov@email.ru', '+7 (921) 456-78-04', 'inactive', false, NOW() - INTERVAL '120 days', NOW() - INTERVAL '60 days'),
    ('760e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'ООО ЛогиСеть', 'logistics@logiseti.ru', '+7 (383) 567-89-05', 'active', false, NOW() - INTERVAL '45 days', NOW() - INTERVAL '10 days'),
    ('760e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 'АО Телеком+', 'admin@telecom.ru', '+7 (495) 678-90-06', 'active', false, NOW() - INTERVAL '30 days', NOW() - INTERVAL '5 days'),
    ('760e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440004', 'ООО МедЦентр', 'info@medcenter.ru', '+7 (499) 789-01-07', 'active', false, NOW() - INTERVAL '90 days', NOW() - INTERVAL '25 days'),
    ('760e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440004', 'ИП Петров В.В.', 'petrov@example.ru', '+7 (905) 890-12-08', 'lead', false, NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 days'),
    ('760e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440005', 'ООО ПроМышленность', 'sales@promysh.ru', '+7 (747) 901-23-09', 'active', false, NOW() - INTERVAL '50 days', NOW() - INTERVAL '12 days'),
    ('760e8400-e29b-41d4-a716-44665544000a', '550e8400-e29b-41d4-a716-446655440005', 'ООО РозницаПлюс', 'contact@roznplus.ru', '+7 (495) 012-34-0a', 'active', false, NOW() - INTERVAL '65 days', NOW() - INTERVAL '18 days'),
    ('760e8400-e29b-41d4-a716-44665544000b', '550e8400-e29b-41d4-a716-446655440006', 'АО СтройКомплекс', 'info@stroycomplex.ru', '+7 (812) 123-45-0b', 'active', false, NOW() - INTERVAL '40 days', NOW() - INTERVAL '8 days'),
    ('760e8400-e29b-41d4-a716-44665544000c', '550e8400-e29b-41d4-a716-446655440006', 'ООО АвтоСервис', 'service@autoservis.ru', '+7 (921) 234-56-0c', 'lead', false, NOW() - INTERVAL '20 days', NOW() - INTERVAL '3 days'),
    ('760e8400-e29b-41d4-a716-44665544000d', '550e8400-e29b-41d4-a716-446655440007', 'ООО ФОДерация', 'hr@federation.ru', '+7 (383) 345-67-0d', 'active', false, NOW() - INTERVAL '80 days', NOW() - INTERVAL '22 days'),
    ('760e8400-e29b-41d4-a716-44665544000e', '550e8400-e29b-41d4-a716-446655440007', 'ООО ОтельСеть', 'booking@hotelnet.ru', '+7 (499) 456-78-0e', 'active', false, NOW() - INTERVAL '35 days', NOW() - INTERVAL '7 days'),
    ('760e8400-e29b-41d4-a716-44665544000f', '550e8400-e29b-41d4-a716-446655440008', 'ООО ПрофОбучение', 'info@profobuch.ru', '+7 (495) 567-89-0f', 'active', false, NOW() - INTERVAL '25 days', NOW() - INTERVAL '4 days'),
    ('760e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440008', 'ИП Иванов И.И.', 'ivanov@biz.ru', '+7 (905) 678-90-10', 'inactive', false, NOW() - INTERVAL '110 days', NOW() - INTERVAL '50 days'),
    ('760e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440009', 'ООО ИнтернетТорг', 'admin@webshop.ru', '+7 (747) 789-01-11', 'active', false, NOW() - INTERVAL '55 days', NOW() - INTERVAL '14 days'),
    ('760e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440009', 'ООО СолнечнаяАэ', 'info@solarae.ru', '+7 (495) 890-12-12', 'lead', false, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day'),
    ('760e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-44665544000a', 'ООО ЭколоПро', 'contact@ecolopro.ru', '+7 (812) 901-23-13', 'active', false, NOW() - INTERVAL '70 days', NOW() - INTERVAL '21 days'),
    ('760e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-44665544000a', 'АО ТехИнновация', 'tech@innovation.ru', '+7 (921) 012-34-14', 'active', false, NOW() - INTERVAL '42 days', NOW() - INTERVAL '9 days');

-- ============================================================================
-- DEALS (20 records)
-- ============================================================================
INSERT INTO crm.deals (id, owner_id, client_id, title, description, status, next_review_at, is_deleted, created_at, updated_at) VALUES
    ('870e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '760e8400-e29b-41d4-a716-446655440001', 'Комплексное страхование офиса', 'Полное страховое покрытие офисного здания', 'in_progress', CURRENT_DATE + INTERVAL '14 days', false, NOW() - INTERVAL '60 days', NOW() - INTERVAL '15 days'),
    ('870e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '760e8400-e29b-41d4-a716-446655440002', 'КАСКО для автопарка', 'Страховка для 10 автомобилей', 'proposal', CURRENT_DATE + INTERVAL '7 days', false, NOW() - INTERVAL '30 days', NOW() - INTERVAL '8 days'),
    ('870e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '760e8400-e29b-41d4-a716-446655440003', 'Страховка имущества', 'Обновление полиса имущества', 'draft', CURRENT_DATE + INTERVAL '21 days', false, NOW() - INTERVAL '45 days', NOW() - INTERVAL '10 days'),
    ('870e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', '760e8400-e29b-41d4-a716-446655440004', 'Медицинское страхование', 'Корпоративная медицина для сотрудников', 'lost', CURRENT_DATE + INTERVAL '1 day', false, NOW() - INTERVAL '90 days', NOW() - INTERVAL '40 days'),
    ('870e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', '760e8400-e29b-41d4-a716-446655440005', 'Ответственность перед третьими лицами', 'ОПВ для производственного объекта', 'negotiation', CURRENT_DATE + INTERVAL '10 days', false, NOW() - INTERVAL '50 days', NOW() - INTERVAL '12 days'),
    ('870e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', '760e8400-e29b-41d4-a716-446655440006', 'Страховка грузов', 'Транспортная логистика', 'won', CURRENT_DATE + INTERVAL '5 days', false, NOW() - INTERVAL '120 days', NOW() - INTERVAL '20 days'),
    ('870e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440004', '760e8400-e29b-41d4-a716-446655440007', 'ДМС для медицинского центра', 'Добровольное медицинское страхование сотрудников', 'in_progress', CURRENT_DATE + INTERVAL '18 days', false, NOW() - INTERVAL '70 days', NOW() - INTERVAL '18 days'),
    ('870e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440004', '760e8400-e29b-41d4-a716-446655440008', 'Страховка ИП', 'Персональная страховка предпринимателя', 'proposal', CURRENT_DATE + INTERVAL '3 days', false, NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 days'),
    ('870e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440005', '760e8400-e29b-41d4-a716-446655440009', 'Страховка цехов', 'Защита от производственных рисков', 'draft', CURRENT_DATE + INTERVAL '28 days', false, NOW() - INTERVAL '25 days', NOW() - INTERVAL '5 days'),
    ('870e8400-e29b-41d4-a716-44665544000a', '550e8400-e29b-41d4-a716-446655440005', '760e8400-e29b-41d4-a716-44665544000a', 'Дополнительное страхование', 'Риск-менеджмент розницы', 'in_progress', CURRENT_DATE + INTERVAL '12 days', false, NOW() - INTERVAL '60 days', NOW() - INTERVAL '16 days'),
    ('870e8400-e29b-41d4-a716-44665544000b', '550e8400-e29b-41d4-a716-446655440006', '760e8400-e29b-41d4-a716-44665544000b', 'Страховка строительства', 'СМР и риски при строительстве', 'negotiation', CURRENT_DATE + INTERVAL '8 days', false, NOW() - INTERVAL '35 days', NOW() - INTERVAL '6 days'),
    ('870e8400-e29b-41d4-a716-44665544000c', '550e8400-e29b-41d4-a716-446655440006', '760e8400-e29b-41d4-a716-44665544000c', 'Автостраховка для сервиса', 'ОСАГО и КАСКО для автомастерской', 'proposal', CURRENT_DATE + INTERVAL '5 days', false, NOW() - INTERVAL '18 days', NOW() - INTERVAL '3 days'),
    ('870e8400-e29b-41d4-a716-44665544000d', '550e8400-e29b-41d4-a716-446655440007', '760e8400-e29b-41d4-a716-44665544000d', 'Страховка персонала', 'Несчастные случаи сотрудников', 'in_progress', CURRENT_DATE + INTERVAL '22 days', false, NOW() - INTERVAL '75 days', NOW() - INTERVAL '20 days'),
    ('870e8400-e29b-41d4-a716-44665544000e', '550e8400-e29b-41d4-a716-446655440007', '760e8400-e29b-41d4-a716-44665544000e', 'Страховка имущества отеля', 'Полное покрытие имущества отеля', 'draft', CURRENT_DATE + INTERVAL '35 days', false, NOW() - INTERVAL '30 days', NOW() - INTERVAL '6 days'),
    ('870e8400-e29b-41d4-a716-44665544000f', '550e8400-e29b-41d4-a716-446655440008', '760e8400-e29b-41d4-a716-44665544000f', 'Обучение и страховка', 'Профессиональная ответственность', 'won', CURRENT_DATE + INTERVAL '2 days', false, NOW() - INTERVAL '100 days', NOW() - INTERVAL '25 days'),
    ('870e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440008', '760e8400-e29b-41d4-a716-446655440010', 'Страховка архива', 'Архивная и документная страховка', 'lost', CURRENT_DATE + INTERVAL '1 day', false, NOW() - INTERVAL '80 days', NOW() - INTERVAL '30 days'),
    ('870e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440009', '760e8400-e29b-41d4-a716-446655440011', 'E-commerce страховка', 'Полное страховое покрытие онлайн-магазина', 'in_progress', CURRENT_DATE + INTERVAL '11 days', false, NOW() - INTERVAL '50 days', NOW() - INTERVAL '13 days'),
    ('870e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440009', '760e8400-e29b-41d4-a716-446655440012', 'Зеленая энергия страховка', 'Страховка солнечных батарей и оборудования', 'proposal', CURRENT_DATE + INTERVAL '9 days', false, NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day'),
    ('870e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-44665544000a', '760e8400-e29b-41d4-a716-446655440013', 'Экологическое страхование', 'Страховка экологических рисков', 'draft', CURRENT_DATE + INTERVAL '24 days', false, NOW() - INTERVAL '65 days', NOW() - INTERVAL '19 days'),
    ('870e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-44665544000a', '760e8400-e29b-41d4-a716-446655440014', 'Инновационные технологии', 'Страховка технологических рисков', 'negotiation', CURRENT_DATE + INTERVAL '6 days', false, NOW() - INTERVAL '40 days', NOW() - INTERVAL '11 days');

-- ============================================================================
-- DEAL_JOURNAL (15 records)
-- ============================================================================
INSERT INTO crm.deal_journal (id, deal_id, author_id, body, created_at) VALUES
    ('980e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Инициирована новая сделка. Контакт установлен с руководством.', NOW() - INTERVAL '60 days'),
    ('980e8400-e29b-41d4-a716-446655440002', '870e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Отправлено коммерческое предложение по почте.', NOW() - INTERVAL '55 days'),
    ('980e8400-e29b-41d4-a716-446655440003', '870e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Клиент согласился с условиями. Назначена встреча.', NOW() - INTERVAL '48 days'),
    ('980e8400-e29b-41d4-a716-446655440004', '870e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Встреча прошла успешно. Обсуждены детали полиса.', NOW() - INTERVAL '42 days'),
    ('980e8400-e29b-41d4-a716-446655440005', '870e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'Отправлено первое КП. Ожидание ответа.', NOW() - INTERVAL '28 days'),
    ('980e8400-e29b-41d4-a716-446655440006', '870e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'Клиент запросил дополнительные скидки.', NOW() - INTERVAL '22 days'),
    ('980e8400-e29b-41d4-a716-446655440007', '870e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'Назначена техническая встреча.', NOW() - INTERVAL '48 days'),
    ('980e8400-e29b-41d4-a716-446655440008', '870e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 'Подписано договор. В активном обсуждении условия.', NOW() - INTERVAL '35 days'),
    ('980e8400-e29b-41d4-a716-446655440009', '870e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 'Полис выдан, клиент подписал все документы.', NOW() - INTERVAL '118 days'),
    ('980e8400-e29b-41d4-a716-44665544000a', '870e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440004', 'Первичный контакт с МедЦентром.', NOW() - INTERVAL '70 days'),
    ('980e8400-e29b-41d4-a716-44665544000b', '870e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440002', 'Встреча с главврачом назначена на следующую неделю.', NOW() - INTERVAL '52 days'),
    ('980e8400-e29b-41d4-a716-44665544000c', '870e8400-e29b-41d4-a716-44665544000b', '550e8400-e29b-41d4-a716-446655440006', 'Представлены варианты покрытия для СМР.', NOW() - INTERVAL '32 days'),
    ('980e8400-e29b-41d4-a716-44665544000d', '870e8400-e29b-41d4-a716-44665544000b', '550e8400-e29b-41d4-a716-446655440006', 'Клиент запросил доработку условий.', NOW() - INTERVAL '25 days'),
    ('980e8400-e29b-41d4-a716-44665544000e', '870e8400-e29b-41d4-a716-44665544000d', '550e8400-e29b-41d4-a716-446655440007', 'Сделка в активном развитии. Ожидание от клиента.', NOW() - INTERVAL '65 days'),
    ('980e8400-e29b-41d4-a716-44665544000f', '870e8400-e29b-41d4-a716-44665544000f', '550e8400-e29b-41d4-a716-446655440008', 'Полис успешно выдан и активирован.', NOW() - INTERVAL '78 days');

-- ============================================================================
-- CALCULATIONS (15 records)
-- ============================================================================
INSERT INTO crm.calculations (id, owner_id, deal_id, insurance_company, program_name, premium_amount, coverage_sum, calculation_date, validity_period, status, files, comments, is_deleted, created_at, updated_at) VALUES
    ('a90e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440001', 'ИНГОССТРАХ', 'Стандарт', 250000.00, 5000000.00, CURRENT_DATE - INTERVAL '60 days', '[2025-01-02, 2026-01-02)', 'approved', '[]', 'Основной вариант', false, NOW() - INTERVAL '58 days', NOW() - INTERVAL '55 days'),
    ('a90e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440002', 'АЛЬФАСТРАХОВКА', 'Премиум', 150000.00, 3000000.00, CURRENT_DATE - INTERVAL '28 days', '[2025-01-02, 2026-01-02)', 'draft', '[]', 'Ожидание согласования', false, NOW() - INTERVAL '26 days', NOW() - INTERVAL '24 days'),
    ('a90e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '870e8400-e29b-41d4-a716-446655440003', 'СОГЛАСИЕ', 'Стандарт', 180000.00, 4000000.00, CURRENT_DATE - INTERVAL '42 days', '[2025-01-02, 2026-01-02)', 'draft', '[]', 'На этапе расчета', false, NOW() - INTERVAL '40 days', NOW() - INTERVAL '38 days'),
    ('a90e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', '870e8400-e29b-41d4-a716-446655440005', 'ТИНЬКОФФ СТРАХОВКА', 'Базовая', 120000.00, 2500000.00, CURRENT_DATE - INTERVAL '48 days', '[2024-11-02, 2025-11-02)', 'rejected', '[]', 'Отклонено по причине высокой ставки', false, NOW() - INTERVAL '46 days', NOW() - INTERVAL '44 days'),
    ('a90e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', '870e8400-e29b-41d4-a716-446655440005', 'ЛИБЕРТИ', 'Оптимум', 135000.00, 3500000.00, CURRENT_DATE - INTERVAL '48 days', '[2025-01-02, 2026-01-02)', 'approved', '[]', 'Согласовано и одобрено', false, NOW() - INTERVAL '46 days', NOW() - INTERVAL '44 days'),
    ('a90e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', '870e8400-e29b-41d4-a716-446655440006', 'ИНГОССТРАХ', 'Премиум', 350000.00, 8000000.00, CURRENT_DATE - INTERVAL '118 days', '[2024-05-02, 2026-05-02)', 'approved', '[]', 'Полис выдан', false, NOW() - INTERVAL '116 days', NOW() - INTERVAL '114 days'),
    ('a90e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440004', '870e8400-e29b-41d4-a716-446655440007', 'АЛЬФАСТРАХОВКА', 'ДМС', 280000.00, 6000000.00, CURRENT_DATE - INTERVAL '68 days', '[2025-01-02, 2026-01-02)', 'approved', '[]', 'Вариант ДМС согласован', false, NOW() - INTERVAL '66 days', NOW() - INTERVAL '64 days'),
    ('a90e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440004', '870e8400-e29b-41d4-a716-446655440008', 'ЛИБЕРТИ', 'Стартап', 45000.00, 1000000.00, CURRENT_DATE - INTERVAL '13 days', '[2025-01-02, 2026-01-02)', 'draft', '[]', 'Начальный расчет для ИП', false, NOW() - INTERVAL '11 days', NOW() - INTERVAL '9 days'),
    ('a90e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440005', '870e8400-e29b-41d4-a716-446655440009', 'СОГЛАСИЕ', 'Промышленность', 200000.00, 5000000.00, CURRENT_DATE - INTERVAL '23 days', '[2025-01-02, 2026-01-02)', 'draft', '[]', 'На согласовании', false, NOW() - INTERVAL '21 days', NOW() - INTERVAL '19 days'),
    ('a90e8400-e29b-41d4-a716-44665544000a', '550e8400-e29b-41d4-a716-446655440005', '870e8400-e29b-41d4-a716-44665544000a', 'ТИНЬКОФФ СТРАХОВКА', 'Розница', 95000.00, 2000000.00, CURRENT_DATE - INTERVAL '58 days', '[2025-01-02, 2026-01-02)', 'approved', '[]', 'Одобрен и активирован', false, NOW() - INTERVAL '56 days', NOW() - INTERVAL '54 days'),
    ('a90e8400-e29b-41d4-a716-44665544000b', '550e8400-e29b-41d4-a716-446655440006', '870e8400-e29b-41d4-a716-44665544000b', 'ИНГОССТРАХ', 'СМР', 500000.00, 10000000.00, CURRENT_DATE - INTERVAL '33 days', '[2025-01-02, 2027-01-02)', 'draft', '[]', 'Расчет для строительного объекта', false, NOW() - INTERVAL '31 days', NOW() - INTERVAL '29 days'),
    ('a90e8400-e29b-41d4-a716-44665544000c', '550e8400-e29b-41d4-a716-446655440006', '870e8400-e29b-41d4-a716-44665544000c', 'АЛЬФАСТРАХОВКА', 'Авто', 65000.00, 1500000.00, CURRENT_DATE - INTERVAL '16 days', '[2025-01-02, 2026-01-02)', 'draft', '[]', 'Первый вариант КП', false, NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days'),
    ('a90e8400-e29b-41d4-a716-44665544000d', '550e8400-e29b-41d4-a716-446655440007', '870e8400-e29b-41d4-a716-44665544000d', 'ЛИБЕРТИ', 'НСУ', 170000.00, 3500000.00, CURRENT_DATE - INTERVAL '73 days', '[2025-01-02, 2026-01-02)', 'approved', '[]', 'Основной вариант несчастных случаев', false, NOW() - INTERVAL '71 days', NOW() - INTERVAL '69 days'),
    ('a90e8400-e29b-41d4-a716-44665544000e', '550e8400-e29b-41d4-a716-446655440007', '870e8400-e29b-41d4-a716-44665544000e', 'СОГЛАСИЕ', 'Отель', 320000.00, 7000000.00, CURRENT_DATE - INTERVAL '28 days', '[2025-01-02, 2026-01-02)', 'draft', '[]', 'На этапе расчета', false, NOW() - INTERVAL '26 days', NOW() - INTERVAL '24 days'),
    ('a90e8400-e29b-41d4-a716-44665544000f', '550e8400-e29b-41d4-a716-446655440008', '870e8400-e29b-41d4-a716-44665544000f', 'ТИНЬКОФФ СТРАХОВКА', 'Профессиональная', 75000.00, 2000000.00, CURRENT_DATE - INTERVAL '98 days', '[2024-07-02, 2026-07-02)', 'approved', '[]', 'Полис выдан', false, NOW() - INTERVAL '96 days', NOW() - INTERVAL '94 days');

-- ============================================================================
-- POLICIES (18 records)
-- ============================================================================
INSERT INTO crm.policies (id, owner_id, client_id, deal_id, calculation_id, policy_number, status, premium, effective_from, effective_to, is_deleted, created_at, updated_at) VALUES
    ('b01e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '760e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440001', 'a90e8400-e29b-41d4-a716-446655440001', 'POL-2024-00001', 'issued', 250000.00, CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '305 days', false, NOW() - INTERVAL '58 days', NOW() - INTERVAL '55 days'),
    ('b01e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '760e8400-e29b-41d4-a716-446655440002', '870e8400-e29b-41d4-a716-446655440002', 'a90e8400-e29b-41d4-a716-446655440002', 'POL-2024-00002', 'draft', 150000.00, NULL, NULL, false, NOW() - INTERVAL '26 days', NOW() - INTERVAL '24 days'),
    ('b01e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '760e8400-e29b-41d4-a716-446655440003', '870e8400-e29b-41d4-a716-446655440003', 'a90e8400-e29b-41d4-a716-446655440003', 'POL-2024-00003', 'draft', 180000.00, NULL, NULL, false, NOW() - INTERVAL '40 days', NOW() - INTERVAL '38 days'),
    ('b01e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', '760e8400-e29b-41d4-a716-446655440005', '870e8400-e29b-41d4-a716-446655440005', 'a90e8400-e29b-41d4-a716-446655440005', 'POL-2024-00004', 'issued', 135000.00, CURRENT_DATE - INTERVAL '48 days', CURRENT_DATE + INTERVAL '317 days', false, NOW() - INTERVAL '46 days', NOW() - INTERVAL '44 days'),
    ('b01e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', '760e8400-e29b-41d4-a716-446655440006', '870e8400-e29b-41d4-a716-446655440006', 'a90e8400-e29b-41d4-a716-446655440006', 'POL-2024-00005', 'issued', 350000.00, CURRENT_DATE - INTERVAL '118 days', CURRENT_DATE + INTERVAL '487 days', false, NOW() - INTERVAL '116 days', NOW() - INTERVAL '114 days'),
    ('b01e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440004', '760e8400-e29b-41d4-a716-446655440007', '870e8400-e29b-41d4-a716-446655440007', 'a90e8400-e29b-41d4-a716-446655440007', 'POL-2024-00006', 'issued', 280000.00, CURRENT_DATE - INTERVAL '68 days', CURRENT_DATE + INTERVAL '297 days', false, NOW() - INTERVAL '66 days', NOW() - INTERVAL '64 days'),
    ('b01e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440004', '760e8400-e29b-41d4-a716-446655440008', '870e8400-e29b-41d4-a716-446655440008', 'a90e8400-e29b-41d4-a716-446655440008', 'POL-2024-00007', 'draft', 45000.00, NULL, NULL, false, NOW() - INTERVAL '11 days', NOW() - INTERVAL '9 days'),
    ('b01e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440005', '760e8400-e29b-41d4-a716-446655440009', '870e8400-e29b-41d4-a716-446655440009', 'a90e8400-e29b-41d4-a716-446655440009', 'POL-2024-00008', 'draft', 200000.00, NULL, NULL, false, NOW() - INTERVAL '21 days', NOW() - INTERVAL '19 days'),
    ('b01e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440005', '760e8400-e29b-41d4-a716-44665544000a', '870e8400-e29b-41d4-a716-44665544000a', 'a90e8400-e29b-41d4-a716-44665544000a', 'POL-2024-00009', 'issued', 95000.00, CURRENT_DATE - INTERVAL '58 days', CURRENT_DATE + INTERVAL '307 days', false, NOW() - INTERVAL '56 days', NOW() - INTERVAL '54 days'),
    ('b01e8400-e29b-41d4-a716-44665544000a', '550e8400-e29b-41d4-a716-446655440006', '760e8400-e29b-41d4-a716-44665544000b', '870e8400-e29b-41d4-a716-44665544000b', 'a90e8400-e29b-41d4-a716-44665544000b', 'POL-2024-00010', 'draft', 500000.00, NULL, NULL, false, NOW() - INTERVAL '31 days', NOW() - INTERVAL '29 days'),
    ('b01e8400-e29b-41d4-a716-44665544000b', '550e8400-e29b-41d4-a716-446655440006', '760e8400-e29b-41d4-a716-44665544000c', '870e8400-e29b-41d4-a716-44665544000c', 'a90e8400-e29b-41d4-a716-44665544000c', 'POL-2024-00011', 'draft', 65000.00, NULL, NULL, false, NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days'),
    ('b01e8400-e29b-41d4-a716-44665544000c', '550e8400-e29b-41d4-a716-446655440007', '760e8400-e29b-41d4-a716-44665544000d', '870e8400-e29b-41d4-a716-44665544000d', 'a90e8400-e29b-41d4-a716-44665544000d', 'POL-2024-00012', 'issued', 170000.00, CURRENT_DATE - INTERVAL '73 days', CURRENT_DATE + INTERVAL '292 days', false, NOW() - INTERVAL '71 days', NOW() - INTERVAL '69 days'),
    ('b01e8400-e29b-41d4-a716-44665544000d', '550e8400-e29b-41d4-a716-446655440007', '760e8400-e29b-41d4-a716-44665544000e', '870e8400-e29b-41d4-a716-44665544000e', 'a90e8400-e29b-41d4-a716-44665544000e', 'POL-2024-00013', 'draft', 320000.00, NULL, NULL, false, NOW() - INTERVAL '26 days', NOW() - INTERVAL '24 days'),
    ('b01e8400-e29b-41d4-a716-44665544000e', '550e8400-e29b-41d4-a716-446655440008', '760e8400-e29b-41d4-a716-44665544000f', '870e8400-e29b-41d4-a716-44665544000f', 'a90e8400-e29b-41d4-a716-44665544000f', 'POL-2024-00014', 'issued', 75000.00, CURRENT_DATE - INTERVAL '98 days', CURRENT_DATE + INTERVAL '267 days', false, NOW() - INTERVAL '96 days', NOW() - INTERVAL '94 days'),
    ('b01e8400-e29b-41d4-a716-44665544000f', '550e8400-e29b-41d4-a716-446655440001', '760e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440001', 'a90e8400-e29b-41d4-a716-446655440001', 'POL-2024-00015', 'issued', 250000.00, CURRENT_DATE - INTERVAL '55 days', CURRENT_DATE + INTERVAL '310 days', false, NOW() - INTERVAL '53 days', NOW() - INTERVAL '50 days'),
    ('b01e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440002', '760e8400-e29b-41d4-a716-446655440002', '870e8400-e29b-41d4-a716-446655440002', 'a90e8400-e29b-41d4-a716-446655440002', 'POL-2024-00016', 'issued', 150000.00, CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE + INTERVAL '340 days', false, NOW() - INTERVAL '23 days', NOW() - INTERVAL '20 days'),
    ('b01e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440003', '760e8400-e29b-41d4-a716-446655440003', '870e8400-e29b-41d4-a716-446655440003', 'a90e8400-e29b-41d4-a716-446655440003', 'POL-2024-00017', 'draft', 180000.00, NULL, NULL, false, NOW() - INTERVAL '38 days', NOW() - INTERVAL '35 days'),
    ('b01e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440009', '760e8400-e29b-41d4-a716-446655440011', '870e8400-e29b-41d4-a716-446655440011', NULL, 'POL-2024-00018', 'draft', NULL, NULL, NULL, false, NOW() - INTERVAL '48 days', NOW() - INTERVAL '45 days');

-- ============================================================================
-- PAYMENTS (20 records)
-- ============================================================================
INSERT INTO crm.payments (id, deal_id, policy_id, sequence, status, planned_date, actual_date, planned_amount, currency, comment, recorded_by_id, created_by_id, updated_by_id, incomes_total, expenses_total, net_total, created_at, updated_at) VALUES
    ('c11e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440001', 'b01e8400-e29b-41d4-a716-446655440001', 1, 'completed', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '60 days', 250000.00, 'RUB', 'Основной платеж', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 250000.00, 15000.00, 235000.00, NOW() - INTERVAL '58 days', NOW() - INTERVAL '55 days'),
    ('c11e8400-e29b-41d4-a716-446655440002', '870e8400-e29b-41d4-a716-446655440001', 'b01e8400-e29b-41d4-a716-446655440001', 2, 'scheduled', CURRENT_DATE + INTERVAL '305 days', NULL, 250000.00, 'RUB', 'Годовой платеж', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', NULL, 0.00, 0.00, 0.00, NOW() - INTERVAL '56 days', NOW() - INTERVAL '55 days'),
    ('c11e8400-e29b-41d4-a716-446655440003', '870e8400-e29b-41d4-a716-446655440005', 'b01e8400-e29b-41d4-a716-446655440004', 1, 'completed', CURRENT_DATE - INTERVAL '48 days', CURRENT_DATE - INTERVAL '48 days', 135000.00, 'RUB', 'Первый платеж', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 135000.00, 8100.00, 126900.00, NOW() - INTERVAL '46 days', NOW() - INTERVAL '44 days'),
    ('c11e8400-e29b-41d4-a716-446655440004', '870e8400-e29b-41d4-a716-446655440005', 'b01e8400-e29b-41d4-a716-446655440004', 2, 'scheduled', CURRENT_DATE + INTERVAL '317 days', NULL, 135000.00, 'RUB', 'Годовой', NULL, '550e8400-e29b-41d4-a716-446655440003', NULL, 0.00, 0.00, 0.00, NOW() - INTERVAL '44 days', NOW() - INTERVAL '44 days'),
    ('c11e8400-e29b-41d4-a716-446655440005', '870e8400-e29b-41d4-a716-446655440006', 'b01e8400-e29b-41d4-a716-446655440005', 1, 'completed', CURRENT_DATE - INTERVAL '118 days', CURRENT_DATE - INTERVAL '118 days', 350000.00, 'RUB', 'Основной', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 350000.00, 21000.00, 329000.00, NOW() - INTERVAL '116 days', NOW() - INTERVAL '114 days'),
    ('c11e8400-e29b-41d4-a716-446655440006', '870e8400-e29b-41d4-a716-446655440007', 'b01e8400-e29b-41d4-a716-446655440006', 1, 'completed', CURRENT_DATE - INTERVAL '68 days', CURRENT_DATE - INTERVAL '68 days', 280000.00, 'RUB', 'ДМС платеж', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 280000.00, 16800.00, 263200.00, NOW() - INTERVAL '66 days', NOW() - INTERVAL '64 days'),
    ('c11e8400-e29b-41d4-a716-446655440007', '870e8400-e29b-41d4-a716-446655440007', 'b01e8400-e29b-41d4-a716-446655440006', 2, 'scheduled', CURRENT_DATE + INTERVAL '297 days', NULL, 280000.00, 'RUB', 'Годовой', NULL, '550e8400-e29b-41d4-a716-446655440004', NULL, 0.00, 0.00, 0.00, NOW() - INTERVAL '64 days', NOW() - INTERVAL '64 days'),
    ('c11e8400-e29b-41d4-a716-446655440008', '870e8400-e29b-41d4-a716-44665544000a', 'b01e8400-e29b-41d4-a716-446655440009', 1, 'completed', CURRENT_DATE - INTERVAL '58 days', CURRENT_DATE - INTERVAL '58 days', 95000.00, 'RUB', 'Розница платеж', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 95000.00, 5700.00, 89300.00, NOW() - INTERVAL '56 days', NOW() - INTERVAL '54 days'),
    ('c11e8400-e29b-41d4-a716-446655440009', '870e8400-e29b-41d4-a716-44665544000a', 'b01e8400-e29b-41d4-a716-446655440009', 2, 'scheduled', CURRENT_DATE + INTERVAL '307 days', NULL, 95000.00, 'RUB', 'Годовой', NULL, '550e8400-e29b-41d4-a716-446655440005', NULL, 0.00, 0.00, 0.00, NOW() - INTERVAL '54 days', NOW() - INTERVAL '54 days'),
    ('c11e8400-e29b-41d4-a716-44665544000a', '870e8400-e29b-41d4-a716-44665544000c', 'b01e8400-e29b-41d4-a716-44665544000c', 1, 'scheduled', CURRENT_DATE + INTERVAL '5 days', NULL, 65000.00, 'RUB', 'Авто платеж', NULL, '550e8400-e29b-41d4-a716-446655440006', NULL, 0.00, 0.00, 0.00, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
    ('c11e8400-e29b-41d4-a716-44665544000b', '870e8400-e29b-41d4-a716-44665544000d', 'b01e8400-e29b-41d4-a716-44665544000c', 1, 'completed', CURRENT_DATE - INTERVAL '73 days', CURRENT_DATE - INTERVAL '73 days', 170000.00, 'RUB', 'НСУ платеж', '550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440007', 170000.00, 10200.00, 159800.00, NOW() - INTERVAL '71 days', NOW() - INTERVAL '69 days'),
    ('c11e8400-e29b-41d4-a716-44665544000c', '870e8400-e29b-41d4-a716-44665544000d', 'b01e8400-e29b-41d4-a716-44665544000c', 2, 'scheduled', CURRENT_DATE + INTERVAL '292 days', NULL, 170000.00, 'RUB', 'Годовой', NULL, '550e8400-e29b-41d4-a716-446655440007', NULL, 0.00, 0.00, 0.00, NOW() - INTERVAL '69 days', NOW() - INTERVAL '69 days'),
    ('c11e8400-e29b-41d4-a716-44665544000d', '870e8400-e29b-41d4-a716-44665544000f', 'b01e8400-e29b-41d4-a716-44665544000e', 1, 'completed', CURRENT_DATE - INTERVAL '98 days', CURRENT_DATE - INTERVAL '98 days', 75000.00, 'RUB', 'Профессиональная', '550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440008', 75000.00, 4500.00, 70500.00, NOW() - INTERVAL '96 days', NOW() - INTERVAL '94 days'),
    ('c11e8400-e29b-41d4-a716-44665544000e', '870e8400-e29b-41d4-a716-44665544000f', 'b01e8400-e29b-41d4-a716-44665544000e', 2, 'scheduled', CURRENT_DATE + INTERVAL '267 days', NULL, 75000.00, 'RUB', 'Годовой', NULL, '550e8400-e29b-41d4-a716-446655440008', NULL, 0.00, 0.00, 0.00, NOW() - INTERVAL '94 days', NOW() - INTERVAL '94 days'),
    ('c11e8400-e29b-41d4-a716-44665544000f', '870e8400-e29b-41d4-a716-446655440001', 'b01e8400-e29b-41d4-a716-44665544000f', 1, 'completed', CURRENT_DATE - INTERVAL '55 days', CURRENT_DATE - INTERVAL '55 days', 250000.00, 'RUB', 'Премиум платеж', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 250000.00, 15000.00, 235000.00, NOW() - INTERVAL '53 days', NOW() - INTERVAL '50 days'),
    ('c11e8400-e29b-41d4-a716-446655440010', '870e8400-e29b-41d4-a716-446655440002', 'b01e8400-e29b-41d4-a716-446655440010', 1, 'completed', CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE - INTERVAL '25 days', 150000.00, 'RUB', 'Основной платеж', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 150000.00, 9000.00, 141000.00, NOW() - INTERVAL '23 days', NOW() - INTERVAL '20 days'),
    ('c11e8400-e29b-41d4-a716-446655440011', '870e8400-e29b-41d4-a716-446655440002', 'b01e8400-e29b-41d4-a716-446655440010', 2, 'scheduled', CURRENT_DATE + INTERVAL '340 days', NULL, 150000.00, 'RUB', 'Годовой', NULL, '550e8400-e29b-41d4-a716-446655440001', NULL, 0.00, 0.00, 0.00, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
    ('c11e8400-e29b-41d4-a716-446655440012', '870e8400-e29b-41d4-a716-446655440011', NULL, 1, 'pending', CURRENT_DATE + INTERVAL '8 days', NULL, 280000.00, 'RUB', 'Ожидающий платеж', NULL, '550e8400-e29b-41d4-a716-446655440009', NULL, 0.00, 0.00, 0.00, NOW() - INTERVAL '46 days', NOW() - INTERVAL '46 days');

-- ============================================================================
-- PAYMENT_INCOMES (15 records)
-- ============================================================================
INSERT INTO crm.payment_incomes (id, payment_id, amount, currency, category, posted_at, note, created_by_id, updated_by_id, created_at, updated_at) VALUES
    ('d21e8400-e29b-41d4-a716-446655440001', 'c11e8400-e29b-41d4-a716-446655440001', 250000.00, 'RUB', 'premium', CURRENT_DATE - INTERVAL '60 days', 'Полученная премия', '550e8400-e29b-41d4-a716-446655440001', NULL, NOW() - INTERVAL '58 days', NOW() - INTERVAL '58 days'),
    ('d21e8400-e29b-41d4-a716-446655440002', 'c11e8400-e29b-41d4-a716-446655440003', 135000.00, 'RUB', 'premium', CURRENT_DATE - INTERVAL '48 days', 'Первая премия', '550e8400-e29b-41d4-a716-446655440003', NULL, NOW() - INTERVAL '46 days', NOW() - INTERVAL '46 days'),
    ('d21e8400-e29b-41d4-a716-446655440003', 'c11e8400-e29b-41d4-a716-446655440005', 350000.00, 'RUB', 'premium', CURRENT_DATE - INTERVAL '118 days', 'Основная премия', '550e8400-e29b-41d4-a716-446655440003', NULL, NOW() - INTERVAL '116 days', NOW() - INTERVAL '116 days'),
    ('d21e8400-e29b-41d4-a716-446655440004', 'c11e8400-e29b-41d4-a716-446655440006', 280000.00, 'RUB', 'premium', CURRENT_DATE - INTERVAL '68 days', 'ДМС премия', '550e8400-e29b-41d4-a716-446655440004', NULL, NOW() - INTERVAL '66 days', NOW() - INTERVAL '66 days'),
    ('d21e8400-e29b-41d4-a716-446655440005', 'c11e8400-e29b-41d4-a716-446655440008', 95000.00, 'RUB', 'premium', CURRENT_DATE - INTERVAL '58 days', 'Розница', '550e8400-e29b-41d4-a716-446655440005', NULL, NOW() - INTERVAL '56 days', NOW() - INTERVAL '56 days'),
    ('d21e8400-e29b-41d4-a716-446655440006', 'c11e8400-e29b-41d4-a716-44665544000b', 170000.00, 'RUB', 'premium', CURRENT_DATE - INTERVAL '73 days', 'НСУ премия', '550e8400-e29b-41d4-a716-446655440007', NULL, NOW() - INTERVAL '71 days', NOW() - INTERVAL '71 days'),
    ('d21e8400-e29b-41d4-a716-446655440007', 'c11e8400-e29b-41d4-a716-44665544000d', 75000.00, 'RUB', 'premium', CURRENT_DATE - INTERVAL '98 days', 'Профессиональная', '550e8400-e29b-41d4-a716-446655440008', NULL, NOW() - INTERVAL '96 days', NOW() - INTERVAL '96 days'),
    ('d21e8400-e29b-41d4-a716-446655440008', 'c11e8400-e29b-41d4-a716-44665544000f', 250000.00, 'RUB', 'premium', CURRENT_DATE - INTERVAL '55 days', 'Премиум платеж', '550e8400-e29b-41d4-a716-446655440001', NULL, NOW() - INTERVAL '53 days', NOW() - INTERVAL '53 days'),
    ('d21e8400-e29b-41d4-a716-446655440009', 'c11e8400-e29b-41d4-a716-446655440010', 150000.00, 'RUB', 'premium', CURRENT_DATE - INTERVAL '25 days', 'Основной платеж', '550e8400-e29b-41d4-a716-446655440001', NULL, NOW() - INTERVAL '23 days', NOW() - INTERVAL '23 days'),
    ('d21e8400-e29b-41d4-a716-44665544000a', 'c11e8400-e29b-41d4-a716-446655440001', 250000.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '59 days', 'Комиссия', '550e8400-e29b-41d4-a716-446655440001', NULL, NOW() - INTERVAL '57 days', NOW() - INTERVAL '57 days'),
    ('d21e8400-e29b-41d4-a716-44665544000b', 'c11e8400-e29b-41d4-a716-446655440003', 135000.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '47 days', 'Комиссия', '550e8400-e29b-41d4-a716-446655440003', NULL, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
    ('d21e8400-e29b-41d4-a716-44665544000c', 'c11e8400-e29b-41d4-a716-446655440005', 350000.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '117 days', 'Комиссия', '550e8400-e29b-41d4-a716-446655440003', NULL, NOW() - INTERVAL '115 days', NOW() - INTERVAL '115 days'),
    ('d21e8400-e29b-41d4-a716-44665544000d', 'c11e8400-e29b-41d4-a716-446655440006', 280000.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '67 days', 'Комиссия', '550e8400-e29b-41d4-a716-446655440004', NULL, NOW() - INTERVAL '65 days', NOW() - INTERVAL '65 days'),
    ('d21e8400-e29b-41d4-a716-44665544000e', 'c11e8400-e29b-41d4-a716-446655440008', 95000.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '57 days', 'Комиссия', '550e8400-e29b-41d4-a716-446655440005', NULL, NOW() - INTERVAL '55 days', NOW() - INTERVAL '55 days'),
    ('d21e8400-e29b-41d4-a716-44665544000f', 'c11e8400-e29b-41d4-a716-44665544000b', 170000.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '72 days', 'Комиссия', '550e8400-e29b-41d4-a716-446655440007', NULL, NOW() - INTERVAL '70 days', NOW() - INTERVAL '70 days');

-- ============================================================================
-- PAYMENT_EXPENSES (15 records)
-- ============================================================================
INSERT INTO crm.payment_expenses (id, payment_id, amount, currency, category, posted_at, note, created_by_id, updated_by_id, created_at, updated_at) VALUES
    ('e31e8400-e29b-41d4-a716-446655440001', 'c11e8400-e29b-41d4-a716-446655440001', 15000.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '60 days', 'Комиссия страховщика', '550e8400-e29b-41d4-a716-446655440001', NULL, NOW() - INTERVAL '58 days', NOW() - INTERVAL '58 days'),
    ('e31e8400-e29b-41d4-a716-446655440002', 'c11e8400-e29b-41d4-a716-446655440003', 8100.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '48 days', 'Комиссия', '550e8400-e29b-41d4-a716-446655440003', NULL, NOW() - INTERVAL '46 days', NOW() - INTERVAL '46 days'),
    ('e31e8400-e29b-41d4-a716-446655440003', 'c11e8400-e29b-41d4-a716-446655440005', 21000.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '118 days', 'Комиссия страховщика', '550e8400-e29b-41d4-a716-446655440003', NULL, NOW() - INTERVAL '116 days', NOW() - INTERVAL '116 days'),
    ('e31e8400-e29b-41d4-a716-446655440004', 'c11e8400-e29b-41d4-a716-446655440006', 16800.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '68 days', 'Комиссия ДМС', '550e8400-e29b-41d4-a716-446655440004', NULL, NOW() - INTERVAL '66 days', NOW() - INTERVAL '66 days'),
    ('e31e8400-e29b-41d4-a716-446655440005', 'c11e8400-e29b-41d4-a716-446655440008', 5700.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '58 days', 'Комиссия розница', '550e8400-e29b-41d4-a716-446655440005', NULL, NOW() - INTERVAL '56 days', NOW() - INTERVAL '56 days'),
    ('e31e8400-e29b-41d4-a716-446655440006', 'c11e8400-e29b-41d4-a716-44665544000b', 10200.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '73 days', 'Комиссия НСУ', '550e8400-e29b-41d4-a716-446655440007', NULL, NOW() - INTERVAL '71 days', NOW() - INTERVAL '71 days'),
    ('e31e8400-e29b-41d4-a716-446655440007', 'c11e8400-e29b-41d4-a716-44665544000d', 4500.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '98 days', 'Комиссия профессиональной', '550e8400-e29b-41d4-a716-446655440008', NULL, NOW() - INTERVAL '96 days', NOW() - INTERVAL '96 days'),
    ('e31e8400-e29b-41d4-a716-446655440008', 'c11e8400-e29b-41d4-a716-44665544000f', 15000.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '55 days', 'Комиссия премиум', '550e8400-e29b-41d4-a716-446655440001', NULL, NOW() - INTERVAL '53 days', NOW() - INTERVAL '53 days'),
    ('e31e8400-e29b-41d4-a716-446655440009', 'c11e8400-e29b-41d4-a716-446655440010', 9000.00, 'RUB', 'commission', CURRENT_DATE - INTERVAL '25 days', 'Комиссия', '550e8400-e29b-41d4-a716-446655440001', NULL, NOW() - INTERVAL '23 days', NOW() - INTERVAL '23 days'),
    ('e31e8400-e29b-41d4-a716-44665544000a', 'c11e8400-e29b-41d4-a716-446655440001', 2000.00, 'RUB', 'processing', CURRENT_DATE - INTERVAL '60 days', 'Обработка', '550e8400-e29b-41d4-a716-446655440001', NULL, NOW() - INTERVAL '58 days', NOW() - INTERVAL '58 days'),
    ('e31e8400-e29b-41d4-a716-44665544000b', 'c11e8400-e29b-41d4-a716-446655440003', 1200.00, 'RUB', 'processing', CURRENT_DATE - INTERVAL '48 days', 'Обработка', '550e8400-e29b-41d4-a716-446655440003', NULL, NOW() - INTERVAL '46 days', NOW() - INTERVAL '46 days'),
    ('e31e8400-e29b-41d4-a716-44665544000c', 'c11e8400-e29b-41d4-a716-446655440005', 2500.00, 'RUB', 'processing', CURRENT_DATE - INTERVAL '118 days', 'Обработка', '550e8400-e29b-41d4-a716-446655440003', NULL, NOW() - INTERVAL '116 days', NOW() - INTERVAL '116 days'),
    ('e31e8400-e29b-41d4-a716-44665544000d', 'c11e8400-e29b-41d4-a716-446655440006', 1800.00, 'RUB', 'processing', CURRENT_DATE - INTERVAL '68 days', 'Обработка', '550e8400-e29b-41d4-a716-446655440004', NULL, NOW() - INTERVAL '66 days', NOW() - INTERVAL '66 days'),
    ('e31e8400-e29b-41d4-a716-44665544000e', 'c11e8400-e29b-41d4-a716-446655440008', 800.00, 'RUB', 'processing', CURRENT_DATE - INTERVAL '58 days', 'Обработка', '550e8400-e29b-41d4-a716-446655440005', NULL, NOW() - INTERVAL '56 days', NOW() - INTERVAL '56 days'),
    ('e31e8400-e29b-41d4-a716-44665544000f', 'c11e8400-e29b-41d4-a716-44665544000b', 1500.00, 'RUB', 'processing', CURRENT_DATE - INTERVAL '73 days', 'Обработка', '550e8400-e29b-41d4-a716-446655440007', NULL, NOW() - INTERVAL '71 days', NOW() - INTERVAL '71 days');

-- ============================================================================
-- TASKS (20 records)
-- ============================================================================
SET search_path TO tasks, public;

INSERT INTO tasks.tasks (id, title, description, status_code, due_at, scheduled_for, payload, assignee_id, author_id, deal_id, policy_id, payment_id, completed_at, cancelled_reason, created_at, updated_at) VALUES
    ('f41e8400-e29b-41d4-a716-446655440001', 'Подготовить КП для Альфа Страхования', 'Составить коммерческое предложение с расчетом премии', 'open', NOW() + INTERVAL '3 days', NULL, '{"type": "proposal"}', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440001', NULL, NULL, NULL, NULL, NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days'),
    ('f41e8400-e29b-41d4-a716-446655440002', 'Звонок клиенту АО БытТех', 'Уточнить требования по страховке', 'open', NOW() + INTERVAL '1 day', NULL, '{"type": "call"}', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440002', NULL, NULL, NULL, NULL, NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days'),
    ('f41e8400-e29b-41d4-a716-446655440003', 'Встреча с руководством ООО ГеоМастер', 'Презентация вариантов страховки', 'scheduled', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days', '{"type": "meeting", "location": "офис клиента"}', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '870e8400-e29b-41d4-a716-446655440003', NULL, NULL, NULL, NULL, NOW() - INTERVAL '15 days', NOW() - INTERVAL '8 days'),
    ('f41e8400-e29b-41d4-a716-446655440004', 'Оформить полис', 'Подготовить документы и передать в страховку', 'done', NOW() - INTERVAL '10 days', NULL, '{"type": "documentation"}', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440001', 'b01e8400-e29b-41d4-a716-446655440001', NULL, NOW() - INTERVAL '11 days', NULL, NOW() - INTERVAL '60 days', NOW() - INTERVAL '11 days'),
    ('f41e8400-e29b-41d4-a716-446655440005', 'Согласование условий сделки', 'Обсудить финальные условия премии', 'in_progress', NOW() + INTERVAL '5 days', NULL, '{"type": "negotiation"}', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', '870e8400-e29b-41d4-a716-446655440005', NULL, NULL, NULL, NULL, NOW() - INTERVAL '35 days', NOW() - INTERVAL '10 days'),
    ('f41e8400-e29b-41d4-a716-446655440006', 'Проверка документов клиента', 'Верификация учредительных документов', 'open', NOW() + INTERVAL '2 days', NULL, '{"type": "verification"}', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '870e8400-e29b-41d4-a716-446655440007', NULL, NULL, NULL, NULL, NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day'),
    ('f41e8400-e29b-41d4-a716-446655440007', 'Подготовить отчет по расчетам', 'Составить финансовый отчет для клиента', 'in_progress', NOW() + INTERVAL '6 days', NULL, '{"type": "report"}', '550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440001', NULL, NULL, NULL, NULL, NOW() - INTERVAL '40 days', NOW() - INTERVAL '5 days'),
    ('f41e8400-e29b-41d4-a716-446655440008', 'Отправить счет', 'Направить счет на оплату', 'done', NOW() - INTERVAL '55 days', NULL, '{"type": "billing"}', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440005', NULL, 'c11e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '47 days', NULL, NOW() - INTERVAL '48 days', NOW() - INTERVAL '47 days'),
    ('f41e8400-e29b-41d4-a716-446655440009', 'Встреча с финансовым директором', 'Обсуждение бюджета и условий', 'open', NOW() + INTERVAL '4 days', NULL, '{"type": "meeting"}', '550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', '870e8400-e29b-41d4-a716-446655440009', NULL, NULL, NULL, NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '5 days'),
    ('f41e8400-e29b-41d4-a716-44665544000a', 'Отправить подтверждение клиенту', 'Направить подтверждение получения документов', 'done', NOW() - INTERVAL '55 days', NULL, '{"type": "notification"}', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440005', NULL, NULL, NOW() - INTERVAL '48 days', NULL, NOW() - INTERVAL '56 days', NOW() - INTERVAL '48 days'),
    ('f41e8400-e29b-41d4-a716-44665544000b', 'Анализ рисков', 'Провести детальный анализ рисков клиента', 'open', NOW() + INTERVAL '8 days', NULL, '{"type": "analysis"}', '550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440002', '870e8400-e29b-41d4-a716-44665544000b', NULL, NULL, NULL, NULL, NOW() - INTERVAL '50 days', NOW() - INTERVAL '2 days'),
    ('f41e8400-e29b-41d4-a716-44665544000c', 'Запрос дополнительной информации', 'Уточнить параметры объекта страховки', 'open', NOW() + INTERVAL '2 days', NULL, '{"type": "request"}', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '870e8400-e29b-41d4-a716-44665544000c', NULL, NULL, NULL, NULL, NOW() - INTERVAL '18 days', NOW() - INTERVAL '3 days'),
    ('f41e8400-e29b-41d4-a716-44665544000d', 'Согласование с управлением', 'Передать КП руководству для одобрения', 'in_progress', NOW() + INTERVAL '1 day', NULL, '{"type": "approval"}', '550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-44665544000d', NULL, NULL, NULL, NULL, NOW() - INTERVAL '12 days', NOW() - INTERVAL '4 days'),
    ('f41e8400-e29b-41d4-a716-44665544000e', 'Осмотр объекта', 'Провести инспекцию имущества для оценки риска', 'scheduled', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days', '{"type": "inspection"}', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', '870e8400-e29b-41d4-a716-44665544000e', NULL, NULL, NULL, NULL, NOW() - INTERVAL '28 days', NOW() - INTERVAL '15 days'),
    ('f41e8400-e29b-41d4-a716-44665544000f', 'Подготовка договора', 'Составить юридически корректный договор', 'done', NOW() - INTERVAL '98 days', NULL, '{"type": "legal"}', '550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440004', '870e8400-e29b-41d4-a716-44665544000f', NULL, NULL, NOW() - INTERVAL '76 days', NULL, NOW() - INTERVAL '100 days', NOW() - INTERVAL '76 days'),
    ('f41e8400-e29b-41d4-a716-446655440010', 'Отправка страховщику', 'Направить документы в страховую компанию', 'done', NOW() - INTERVAL '93 days', NULL, '{"type": "submission"}', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', '870e8400-e29b-41d4-a716-44665544000f', 'b01e8400-e29b-41d4-a716-44665544000e', NULL, NOW() - INTERVAL '80 days', NULL, NOW() - INTERVAL '95 days', NOW() - INTERVAL '80 days'),
    ('f41e8400-e29b-41d4-a716-446655440011', 'Мониторинг платежей', 'Отслеживать своевременность платежей', 'open', NOW() + INTERVAL '305 days', NULL, '{"type": "monitoring"}', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440011', 'b01e8400-e29b-41d4-a716-446655440001', 'c11e8400-e29b-41d4-a716-446655440001', NULL, NULL, NOW() - INTERVAL '58 days', NOW() - INTERVAL '20 days'),
    ('f41e8400-e29b-41d4-a716-446655440012', 'Напоминание клиенту о платеже', 'Направить уведомление о предстоящем платеже', 'pending', NOW() + INTERVAL '300 days', NOW() + INTERVAL '300 days', '{"type": "reminder"}', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440011', 'b01e8400-e29b-41d4-a716-446655440001', NULL, NULL, NULL, NOW() - INTERVAL '55 days', NOW() - INTERVAL '55 days'),
    ('f41e8400-e29b-41d4-a716-446655440013', 'Подтверждение получения платежа', 'Проверить поступление платежа на счет', 'done', NOW() - INTERVAL '58 days', NULL, '{"type": "confirmation"}', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440001', 'b01e8400-e29b-41d4-a716-446655440001', 'c11e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '57 days', NULL, NOW() - INTERVAL '58 days', NOW() - INTERVAL '57 days'),
    ('f41e8400-e29b-41d4-a716-446655440014', 'Подготовка счета на оплату', 'Выставить счет на оплату полиса', 'done', NOW() - INTERVAL '20 days', NULL, '{"type": "billing"}', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '870e8400-e29b-41d4-a716-446655440002', NULL, 'c11e8400-e29b-41d4-a716-446655440010', NOW() - INTERVAL '19 days', NULL, NOW() - INTERVAL '23 days', NOW() - INTERVAL '19 days');

-- ============================================================================
-- Summary
-- ============================================================================
\c crm postgres
SET search_path TO crm, public;

SELECT 'TEST DATA LOADED SUCCESSFULLY' as status;
SELECT 'Clients: ' || COUNT(*) FROM crm.clients WHERE created_at > NOW() - INTERVAL '100 days';
SELECT 'Deals: ' || COUNT(*) FROM crm.deals WHERE created_at > NOW() - INTERVAL '100 days';
SELECT 'Policies: ' || COUNT(*) FROM crm.policies WHERE created_at > NOW() - INTERVAL '100 days';
SELECT 'Payments: ' || COUNT(*) FROM crm.payments WHERE created_at > NOW() - INTERVAL '100 days';

\echo 'Seed completed!'
