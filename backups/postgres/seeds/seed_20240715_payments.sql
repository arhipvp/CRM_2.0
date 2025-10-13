-- seed_20240715_payments.sql
-- Плановые и фактические платежи для CRM 2.0, связанные со сделками и полисами из seed_20240715_crm.sql.
-- Источник: задача CRM-TEST-DATA-01, структура соответствует docs/data-model.md, docs/domain-model.md и docs/api/payments.md.
-- Скрипт идемпотентен: применяет UPSERT по первичным ключам и предотвращает дублирование истории.

BEGIN;

INSERT INTO payments.payments (
    id,
    deal_id,
    policy_id,
    payment_type,
    planned_date,
    actual_date,
    amount,
    currency,
    status,
    direction,
    recorded_by,
    counterparty,
    notes,
    external_ref
)
VALUES
    (
        '5d8d0d68-6e5a-421d-9c2c-777777777777'::uuid,
        'd1b96491-1ef3-4ff5-8fdc-333333333333'::uuid,
        '9c1c2d25-3f6f-46f8-872f-555555555555'::uuid,
        'INITIAL',
        DATE '2024-07-05',
        DATE '2024-07-04',
        2500000.00,
        'RUB',
        'received',
        'inbound',
        '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid,
        'ООО "Страховые решения"',
        'Поступление аванса за корпоративный полис, платёж пришёл на день раньше плановой даты.',
        'CRM-PMT-0001'
    ),
    (
        '3c3ab2c4-6e0a-4bfb-9ed4-888888888888'::uuid,
        'a2c7305a-3bb2-4a8e-9a02-444444444444'::uuid,
        '6bfb4360-3572-4b70-9eb6-666666666666'::uuid,
        'INSTALLMENT',
        DATE '2024-08-05',
        NULL,
        180000.00,
        'RUB',
        'planned',
        'inbound',
        '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid,
        'Иван Петров',
        'Первый платёж по КАСКО, ожидается после выдачи счёта.',
        'CRM-PMT-0002'
    ),
    (
        'af5f1f29-fbaa-4fbe-a4ec-999999999999'::uuid,
        'd1b96491-1ef3-4ff5-8fdc-333333333333'::uuid,
        '9c1c2d25-3f6f-46f8-872f-555555555555'::uuid,
        'COMMISSION',
        DATE '2024-07-10',
        NULL,
        350000.00,
        'RUB',
        'expected',
        'outbound',
        '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid,
        'ООО "Агентство сопровождения"',
        'Вознаграждение исполнителю за оформление корпоративного полиса, ожидает подтверждение бухгалтерии.',
        'CRM-PMT-0003'
    )
ON CONFLICT (id) DO UPDATE
    SET payment_type = EXCLUDED.payment_type,
        planned_date = EXCLUDED.planned_date,
        actual_date = EXCLUDED.actual_date,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        direction = EXCLUDED.direction,
        recorded_by = EXCLUDED.recorded_by,
        counterparty = EXCLUDED.counterparty,
        notes = EXCLUDED.notes,
        external_ref = EXCLUDED.external_ref,
        updated_at = timezone('utc', now());

INSERT INTO payments.payment_history (id, payment_id, changed_at, changed_by, change_summary)
VALUES
    (
        'c7a9de7f-f8f5-4a20-9f4e-aaaaaaaab001'::uuid,
        '5d8d0d68-6e5a-421d-9c2c-777777777777'::uuid,
        timezone('utc', TIMESTAMP '2024-07-04 07:45:00'),
        '0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid,
        'Статус изменён на received, приложено подтверждение банка.'
    ),
    (
        'f07d092d-3f61-49aa-bdb4-aaaaaaaab002'::uuid,
        'af5f1f29-fbaa-4fbe-a4ec-999999999999'::uuid,
        timezone('utc', TIMESTAMP '2024-07-06 10:15:00'),
        '6fda31ff-7b74-4ba0-9188-8d6504b63005'::uuid,
        'Подписан акт выполненных работ, ожидается подтверждение выплаты.'
    )
ON CONFLICT (id) DO UPDATE
    SET payment_id = EXCLUDED.payment_id,
        changed_at = EXCLUDED.changed_at,
        changed_by = EXCLUDED.changed_by,
        change_summary = EXCLUDED.change_summary;

INSERT INTO payments.payment_schedules (id, deal_id, payment_type, due_date, amount, currency, notes)
VALUES
    (
        '8d5a86c8-9cde-4f53-9d5b-bbbbbbbb0001'::uuid,
        'a2c7305a-3bb2-4a8e-9a02-444444444444'::uuid,
        'INSTALLMENT',
        DATE '2024-08-05',
        180000.00,
        'RUB',
        'Плановый взнос клиента после выдачи полиса.'
    ),
    (
        '4ac31873-8f08-4efc-a9f7-bbbbbbbb0002'::uuid,
        'd1b96491-1ef3-4ff5-8fdc-333333333333'::uuid,
        'COMMISSION',
        DATE '2024-07-10',
        350000.00,
        'RUB',
        'Выплата партнёру-исполнителю из комиссии страховщика.'
    )
ON CONFLICT (id) DO UPDATE
    SET deal_id = EXCLUDED.deal_id,
        payment_type = EXCLUDED.payment_type,
        due_date = EXCLUDED.due_date,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        notes = EXCLUDED.notes;

COMMIT;
