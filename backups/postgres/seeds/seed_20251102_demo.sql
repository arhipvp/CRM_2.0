-- Demo seed data for CRM 2.0 (generated 2025-11-02)
-- Наполняет ключевые таблицы CRM/Tasks платежами, полисами и задачами.
-- Скрипт идемпотентен: повторный запуск создаёт только новые записи благодаря уникальным UUID.

-- Убедимся, что базовые статусы задач присутствуют
INSERT INTO tasks.task_statuses (code, name, description, is_final, created_at)
VALUES
    ('pending', 'В ожидании', 'Новая задача, ожидает обработки', false, timezone('utc', now())),
    ('in_progress', 'В работе', 'Исполнитель уже занимается задачей', false, timezone('utc', now())),
    ('completed', 'Завершена', 'Работы выполнены', true, timezone('utc', now())),
    ('cancelled', 'Отменена', 'Задача отменена или больше не актуальна', true, timezone('utc', now()))
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_final = EXCLUDED.is_final;

DO $$
DECLARE
    admin_id uuid;
    seller_id uuid;
    i integer;
    client_id uuid;
    deal_id uuid;
    policy_id uuid;
    payment_id uuid;
    premium_amount numeric(14,2);
    expense_amount numeric(14,2);
    status_code text;
BEGIN
    SELECT id INTO admin_id FROM auth.users WHERE email = 'qa.admin@example.com';
    IF admin_id IS NULL THEN
        RAISE EXCEPTION 'User qa.admin@example.com not found in auth.users';
    END IF;

    SELECT id INTO seller_id FROM auth.users WHERE email = 'test@example.com';
    IF seller_id IS NULL THEN
        seller_id := admin_id;
    END IF;

    FOR i IN 1..15 LOOP
        client_id := gen_random_uuid();
        INSERT INTO crm.clients (id, owner_id, name, email, phone, status, created_at, updated_at)
        VALUES (
            client_id,
            admin_id,
            format('Тестовый клиент %s', i),
            format('client%02s@example.com', i),
            format('+7 (900) %03s-%04s', lpad((300 + i)::text, 3, '0'), lpad((1111 + i)::text, 4, '0')),
            CASE WHEN i % 5 = 0 THEN 'suspended' ELSE 'active' END,
            timezone('utc', now()) - (i || ' days')::interval,
            timezone('utc', now())
        );

        deal_id := gen_random_uuid();
        INSERT INTO crm.deals (id, owner_id, client_id, title, description, status, next_review_at, created_at, updated_at)
        VALUES (
            deal_id,
            seller_id,
            client_id,
            format('Сделка #%s', i),
            format('Описание сделки #%s: комплексное страхование', i),
            CASE
                WHEN i % 3 = 0 THEN 'proposal'
                WHEN i % 3 = 1 THEN 'in_progress'
                ELSE 'negotiation'
            END,
            current_date + ((i % 10) || ' days')::interval,
            timezone('utc', now()) - (i || ' days')::interval,
            timezone('utc', now())
        );

        policy_id := gen_random_uuid();
        premium_amount := (45000 + (i * 1200))::numeric(14,2);
        INSERT INTO crm.policies (
            id, owner_id, client_id, deal_id, policy_number, status,
            effective_from, effective_to, premium, created_at, updated_at
        )
        VALUES (
            policy_id,
            admin_id,
            client_id,
            deal_id,
            format('QA-%s-%s', to_char(current_date, 'YYYYMM'), lpad(i::text, 3, '0')),
            CASE WHEN i % 4 = 0 THEN 'pending' ELSE 'active' END,
            current_date - ((i + 7) || ' days')::interval,
            current_date + ((180 + i) || ' days')::interval,
            premium_amount,
            timezone('utc', now()) - (i || ' days')::interval,
            timezone('utc', now())
        );

        payment_id := gen_random_uuid();
        expense_amount := round(premium_amount * 0.12, 2);

        INSERT INTO crm.payments (
            id, deal_id, policy_id, sequence, status,
            planned_date, actual_date, planned_amount, currency, comment,
            recorded_by_id, created_by_id, updated_by_id,
            incomes_total, expenses_total, net_total,
            created_at, updated_at, is_deleted
        )
        VALUES (
            payment_id,
            deal_id,
            policy_id,
            1,
            CASE WHEN i % 4 = 0 THEN 'scheduled' ELSE 'posted' END,
            current_date + ((i % 15) || ' days')::interval,
            current_date - ((i % 6) || ' days')::interval,
            premium_amount,
            'RUB',
            format('Оплата по полису %s', policy_id),
            admin_id,
            admin_id,
            admin_id,
            premium_amount,
            expense_amount,
            premium_amount - expense_amount,
            timezone('utc', now()) - (i || ' days')::interval,
            timezone('utc', now()),
            false
        );

        INSERT INTO crm.payment_incomes (
            id, payment_id, amount, currency, category, posted_at, note,
            created_by_id, updated_by_id, is_deleted, created_at, updated_at
        )
        VALUES (
            gen_random_uuid(),
            payment_id,
            premium_amount,
            'RUB',
            CASE WHEN i % 2 = 0 THEN 'premium' ELSE 'installment' END,
            current_date - ((i % 5) || ' days')::interval,
            'Поступление оплаты от клиента',
            admin_id,
            admin_id,
            false,
            timezone('utc', now()) - (i || ' days')::interval,
            timezone('utc', now())
        );

        INSERT INTO crm.payment_expenses (
            id, payment_id, amount, currency, category, posted_at, note,
            created_by_id, updated_by_id, is_deleted, created_at, updated_at
        )
        VALUES (
            gen_random_uuid(),
            payment_id,
            expense_amount,
            'RUB',
            'commission',
            current_date - ((i % 4) || ' days')::interval,
            'Комиссия партнёру',
            admin_id,
            admin_id,
            false,
            timezone('utc', now()) - (i || ' days')::interval,
            timezone('utc', now())
        );

        status_code := CASE
            WHEN i % 3 = 0 THEN 'completed'
            WHEN i % 3 = 1 THEN 'in_progress'
            ELSE 'pending'
        END;

        INSERT INTO tasks.tasks (
            id, title, description, status_code, due_at, scheduled_for,
            payload, assignee_id, author_id, deal_id, policy_id, payment_id,
            created_at, updated_at
        )
        VALUES (
            gen_random_uuid(),
            format('Задача по сделке #%s', i),
            'Связаться с клиентом и обновить статус сделки.',
            status_code,
            timezone('utc', now()) + ((i % 12) || ' days')::interval,
            timezone('utc', now()) + ((i % 6) || ' days')::interval,
            jsonb_build_object(
                'priority', CASE WHEN i % 2 = 0 THEN 'high' ELSE 'normal' END,
                'channel', CASE WHEN i % 3 = 0 THEN 'phone' ELSE 'email' END
            ),
            seller_id,
            admin_id,
            deal_id,
            policy_id,
            payment_id,
            timezone('utc', now()) - (i || ' days')::interval,
            timezone('utc', now())
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;
