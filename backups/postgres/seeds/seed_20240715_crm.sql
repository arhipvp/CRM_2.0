-- seed_20240715_crm.sql
-- Клиенты, сделки и полисы для тестовых сценариев CRM 2.0.
-- Источник: задача CRM-TEST-DATA-01, структура соответствует docs/data-model.md и docs/domain-model.md.
-- Скрипт идемпотентен (UPSERT по первичным ключам) и использует согласованные UUID из seed_20240715_auth.sql.

BEGIN;

INSERT INTO crm.clients (id, owner_id, name, email, phone, status)
VALUES
    ('c1a7436c-7a7a-4e2a-9b7b-111111111111'::uuid, 'e94f8a3a-2b1d-4d1f-a42e-3056c9cf5002'::uuid, 'ООО "Страховые решения"', 'procurement@insure-corp.test', '+7-495-100-2000', 'active'),
    ('f2b89c12-68d8-4ce6-8c2f-222222222222'::uuid, 'e94f8a3a-2b1d-4d1f-a42e-3056c9cf5002'::uuid, 'Иван Петров', 'ivan.petrov@example.com', '+7-926-555-1234', 'active')
ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        status = EXCLUDED.status,
        owner_id = EXCLUDED.owner_id,
        updated_at = timezone('utc', now());

INSERT INTO crm.deals (
    id,
    owner_id,
    client_id,
    title,
    description,
    status,
    next_review_at
)
VALUES
    (
        'd1b96491-1ef3-4ff5-8fdc-333333333333'::uuid,
        'e94f8a3a-2b1d-4d1f-a42e-3056c9cf5002'::uuid,
        'c1a7436c-7a7a-4e2a-9b7b-111111111111'::uuid,
        'Комплексное страхование автопарка',
        'Клиент хочет объединить полисы ОСАГО и КАСКО для 25 автомобилей, включая телематический мониторинг.',
        'in_progress',
        DATE '2024-07-22'
    ),
    (
        'a2c7305a-3bb2-4a8e-9a02-444444444444'::uuid,
        '6fda31ff-7b74-4ba0-9188-8d6504b63005'::uuid,
        'f2b89c12-68d8-4ce6-8c2f-222222222222'::uuid,
        'КАСКО для электромобиля',
        'Частный клиент подбирает КАСКО с франшизой и страхованием батареи для Tesla Model Y.',
        'proposal_sent',
        DATE '2024-07-29'
)
ON CONFLICT (id) DO UPDATE
    SET owner_id = EXCLUDED.owner_id,
        client_id = EXCLUDED.client_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        next_review_at = EXCLUDED.next_review_at,
        updated_at = timezone('utc', now());

INSERT INTO crm.policies (id, owner_id, client_id, deal_id, policy_number, status, premium, effective_from, effective_to)
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

INSERT INTO crm.payments (
    id,
    deal_id,
    policy_id,
    sequence,
    status,
    planned_date,
    actual_date,
    planned_amount,
    currency,
    comment,
    recorded_by_id,
    created_by_id,
    updated_by_id,
    incomes_total,
    expenses_total,
    net_total
)
VALUES
        (
            '5d8d0d68-6e5a-421d-9c2c-777777777777'::uuid,
            'd1b96491-1ef3-4ff5-8fdc-333333333333'::uuid,
            '9c1c2d25-3f6f-46f8-872f-555555555555'::uuid,
            1,
            'paid',
            DATE '2024-07-05',
            DATE '2024-07-04',
            2500000.00,
            'RUB',
            'Поступление аванса за корпоративный полис, подтверждено банковской выпиской.',
            '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid,
            '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid,
            '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid,
            2500000.00,
            0.00,
            2500000.00
        ),
        (
            '3c3ab2c4-6e0a-4bfb-9ed4-888888888888'::uuid,
            'd1b96491-1ef3-4ff5-8fdc-333333333333'::uuid,
            '9c1c2d25-3f6f-46f8-872f-555555555555'::uuid,
            2,
            'paid',
            DATE '2024-07-12',
            DATE '2024-07-12',
            350000.00,
            'RUB',
            'Страховщик перечислил агентскую комиссию по корпоративному полису.',
            '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid,
            '6fda31ff-7b74-4ba0-9188-8d6504b63005'::uuid,
            '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid,
            350000.00,
            0.00,
            350000.00
        ),
        (
            'af5f1f29-fbaa-4fbe-a4ec-999999999999'::uuid,
            'd1b96491-1ef3-4ff5-8fdc-333333333333'::uuid,
            '9c1c2d25-3f6f-46f8-872f-555555555555'::uuid,
            3,
            'scheduled',
            DATE '2024-07-18',
            DATE '2024-07-18',
            120000.00,
            'RUB',
            'Плановый расход на оплату услуг внешнего партнёра по корпоративному полису.',
            '709cb79d-9ac3-4a56-88ac-9a8bc7033003'::uuid,
            '709cb79d-9ac3-4a56-88ac-9a8bc7033003'::uuid,
            '709cb79d-9ac3-4a56-88ac-9a8bc7033003'::uuid,
            0.00,
            120000.00,
            -120000.00
        )
ON CONFLICT (id) DO UPDATE
    SET deal_id = EXCLUDED.deal_id,
        policy_id = EXCLUDED.policy_id,
        sequence = EXCLUDED.sequence,
        status = EXCLUDED.status,
        planned_date = EXCLUDED.planned_date,
        actual_date = EXCLUDED.actual_date,
        planned_amount = EXCLUDED.planned_amount,
        currency = EXCLUDED.currency,
        comment = EXCLUDED.comment,
        recorded_by_id = EXCLUDED.recorded_by_id,
        created_by_id = EXCLUDED.created_by_id,
        updated_by_id = EXCLUDED.updated_by_id,
        incomes_total = EXCLUDED.incomes_total,
        expenses_total = EXCLUDED.expenses_total,
        net_total = EXCLUDED.net_total,
        updated_at = timezone('utc', now());

INSERT INTO crm.payment_incomes (
    id,
    payment_id,
    amount,
    currency,
    category,
    posted_at,
    note,
    created_by_id,
    updated_by_id
)
VALUES
        (
            '71b08cc6-0d62-4e8c-8b7b-aaaaaaaab001'::uuid,
            '5d8d0d68-6e5a-421d-9c2c-777777777777'::uuid,
            2500000.00,
            'RUB',
            'premium',
            DATE '2024-07-04',
            'Авансовый платёж клиента за корпоративный полис.',
            '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid,
            '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid
        ),
        (
            '71b08cc6-0d62-4e8c-8b7b-aaaaaaaab002'::uuid,
            '3c3ab2c4-6e0a-4bfb-9ed4-888888888888'::uuid,
            350000.00,
            'RUB',
            'commission',
            DATE '2024-07-12',
            'Комиссия страховщика после выдачи корпоративного полиса.',
            '6fda31ff-7b74-4ba0-9188-8d6504b63005'::uuid,
            '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid
        )
ON CONFLICT (id) DO UPDATE
    SET payment_id = EXCLUDED.payment_id,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        category = EXCLUDED.category,
        posted_at = EXCLUDED.posted_at,
        note = EXCLUDED.note,
        updated_by_id = EXCLUDED.updated_by_id,
        updated_at = timezone('utc', now());

INSERT INTO crm.payment_expenses (
    id,
    payment_id,
    amount,
    currency,
    category,
    posted_at,
    note,
    created_by_id,
    updated_by_id
)
VALUES
        (
            'f67b20fd-3bf7-4c55-92af-bbbbbbbbc001'::uuid,
            'af5f1f29-fbaa-4fbe-a4ec-999999999999'::uuid,
            120000.00,
            'RUB',
            'partner_fee',
            DATE '2024-07-18',
            'Выплата подрядчику за телематическую установку на корпоративном автопарке.',
            '709cb79d-9ac3-4a56-88ac-9a8bc7033003'::uuid,
            '709cb79d-9ac3-4a56-88ac-9a8bc7033003'::uuid
        )
ON CONFLICT (id) DO UPDATE
    SET payment_id = EXCLUDED.payment_id,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        category = EXCLUDED.category,
        posted_at = EXCLUDED.posted_at,
        note = EXCLUDED.note,
        updated_by_id = EXCLUDED.updated_by_id,
        updated_at = timezone('utc', now());

COMMIT;
