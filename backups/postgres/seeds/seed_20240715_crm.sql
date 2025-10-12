-- seed_20240715_crm.sql
-- Клиенты, сделки и полисы для тестовых сценариев CRM 2.0.
-- Источник: задача CRM-TEST-DATA-01, структура соответствует docs/data-model.md и docs/domain-model.md.
-- Скрипт идемпотентен (UPSERT по первичным ключам) и использует согласованные UUID из seed_20240715_auth.sql.

BEGIN;

WITH params AS (
    SELECT
        '8b8e7c46-278b-4a74-9ab3-000000000001'::uuid AS tenant_id
)
INSERT INTO crm.clients (id, tenant_id, owner_id, name, email, phone, status)
SELECT
    data.id,
    params.tenant_id,
    data.owner_id,
    data.name,
    data.email,
    data.phone,
    data.status
FROM params
CROSS JOIN (
    VALUES
        ('c1a7436c-7a7a-4e2a-9b7b-111111111111'::uuid, 'e94f8a3a-2b1d-4d1f-a42e-3056c9cf5002'::uuid, 'ООО "Страховые решения"', 'procurement@insure-corp.test', '+7-495-100-2000', 'active'),
        ('f2b89c12-68d8-4ce6-8c2f-222222222222'::uuid, 'e94f8a3a-2b1d-4d1f-a42e-3056c9cf5002'::uuid, 'Иван Петров', 'ivan.petrov@example.com', '+7-926-555-1234', 'active')
) AS data(id, owner_id, name, email, phone, status)
ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        status = EXCLUDED.status,
        owner_id = EXCLUDED.owner_id,
        updated_at = timezone('utc', now());

WITH params AS (
    SELECT
        '8b8e7c46-278b-4a74-9ab3-000000000001'::uuid AS tenant_id
)
INSERT INTO crm.deals (id, tenant_id, owner_id, client_id, title, description, status, value)
SELECT
    data.id,
    params.tenant_id,
    data.owner_id,
    data.client_id,
    data.title,
    data.description,
    data.status,
    data.value
FROM params
CROSS JOIN (
    VALUES
        (
            'd1b96491-1ef3-4ff5-8fdc-333333333333'::uuid,
            'e94f8a3a-2b1d-4d1f-a42e-3056c9cf5002'::uuid,
            'c1a7436c-7a7a-4e2a-9b7b-111111111111'::uuid,
            'Комплексное страхование автопарка',
            'Клиент хочет объединить полисы ОСАГО и КАСКО для 25 автомобилей, включая телематический мониторинг.',
            'in_progress',
            2500000.00
        ),
        (
            'a2c7305a-3bb2-4a8e-9a02-444444444444'::uuid,
            '6fda31ff-7b74-4ba0-9188-8d6504b63005'::uuid,
            'f2b89c12-68d8-4ce6-8c2f-222222222222'::uuid,
            'КАСКО для электромобиля',
            'Частный клиент подбирает КАСКО с франшизой и страхованием батареи для Tesla Model Y.',
            'proposal_sent',
            180000.00
        )
) AS data(id, owner_id, client_id, title, description, status, value)
ON CONFLICT (id) DO UPDATE
    SET owner_id = EXCLUDED.owner_id,
        client_id = EXCLUDED.client_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        value = EXCLUDED.value,
        updated_at = timezone('utc', now());

WITH params AS (
    SELECT
        '8b8e7c46-278b-4a74-9ab3-000000000001'::uuid AS tenant_id
)
INSERT INTO crm.policies (id, tenant_id, owner_id, client_id, deal_id, policy_number, status, premium, effective_from, effective_to)
SELECT
    data.id,
    params.tenant_id,
    data.owner_id,
    data.client_id,
    data.deal_id,
    data.policy_number,
    data.status,
    data.premium,
    data.effective_from,
    data.effective_to
FROM params
CROSS JOIN (
    VALUES
        (
            '9c1c2d25-3f6f-46f8-872f-555555555555'::uuid,
            '709cb79d-9ac3-4a56-88ac-9a8bc7033003'::uuid,
            'c1a7436c-7a7a-4e2a-9b7b-111111111111'::uuid,
            'd1b96491-1ef3-4ff5-8fdc-333333333333'::uuid,
            'CR-2024-0001',
            'issued',
            2500000.00,
            DATE '2024-07-01',
            DATE '2025-06-30'
        ),
        (
            '6bfb4360-3572-4b70-9eb6-666666666666'::uuid,
            '709cb79d-9ac3-4a56-88ac-9a8bc7033003'::uuid,
            'f2b89c12-68d8-4ce6-8c2f-222222222222'::uuid,
            'a2c7305a-3bb2-4a8e-9a02-444444444444'::uuid,
            'CR-2024-0002',
            'draft',
            180000.00,
            DATE '2024-08-01',
            DATE '2025-07-31'
        )
) AS data(id, owner_id, client_id, deal_id, policy_number, status, premium, effective_from, effective_to)
ON CONFLICT (id) DO UPDATE
    SET owner_id = EXCLUDED.owner_id,
        client_id = EXCLUDED.client_id,
        deal_id = EXCLUDED.deal_id,
        policy_number = EXCLUDED.policy_number,
        status = EXCLUDED.status,
        premium = EXCLUDED.premium,
        effective_from = EXCLUDED.effective_from,
        effective_to = EXCLUDED.effective_to,
        updated_at = timezone('utc', now());

COMMIT;
