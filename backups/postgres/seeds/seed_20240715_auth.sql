-- seed_20240715_auth.sql
-- TODO: заменить ROLE_FINANCE_MANAGER/ROLE_TEAM_LEAD на профиль главного админа после обновления ролевой модели.
-- Базовые пользователи и роли для smoke-тестов CRM 2.0.
-- Источник: задача CRM-TEST-DATA-01, опирается на описания схем в docs/data-model.md.
-- Скрипт идемпотентен и использует UPSERT, поэтому может выполняться повторно.

BEGIN;

WITH role_source AS (
    SELECT * FROM (
        VALUES
            ('33333333-3333-3333-3333-333333333333'::uuid, 'ROLE_SALES_AGENT', 'Роль продавца, ведущего сделку и клиента'),
            ('44444444-4444-4444-4444-444444444444'::uuid, 'ROLE_EXECUTOR', 'Исполнитель расчётов и оформления полисов'),
            ('55555555-5555-5555-5555-555555555555'::uuid, 'ROLE_FINANCE_MANAGER', 'Финансовый менеджер, подтверждает платежи'),
            ('66666666-6666-6666-6666-666666666666'::uuid, 'ROLE_TEAM_LEAD', 'Руководитель направления, контролирует воронку')
    ) AS v(id, name, description)
),
upsert_roles AS (
    INSERT INTO auth.roles (id, name, description)
    SELECT id, name, description FROM role_source
    ON CONFLICT (name) DO UPDATE
        SET description = EXCLUDED.description
    RETURNING name, id
),
role_map AS (
    SELECT name, id FROM upsert_roles
    UNION
    SELECT name, id FROM auth.roles WHERE name IN ('ROLE_USER', 'ROLE_ADMIN')
),
user_source AS (
    SELECT * FROM (
        VALUES
            ('b342f7f5-0d59-4cdd-bc17-5e2d6c3fb001'::uuid, 'anna.admin@example.com', '$2b$12$tqZKsOqMdeXVUq.KDTuD4e4dA9yc5VuOYhqY822XCD/Mlla.W02sm', true, ARRAY['ROLE_ADMIN', 'ROLE_USER']),
            ('e94f8a3a-2b1d-4d1f-a42e-3056c9cf5002'::uuid, 'sergey.seller@example.com', '$2b$12$7F7eD56MrGWs3yaJnBEVw.yboTJTEKggbyHBWF5/SCHasATgS3vIC', true, ARRAY['ROLE_SALES_AGENT', 'ROLE_USER']),
            ('709cb79d-9ac3-4a56-88ac-9a8bc7033003'::uuid, 'elena.executor@example.com', '$2b$12$ROtNG.IHFiLHEGCj9BW5e.4kq/Px.sF2K6KqoBxyWY9/3WEku4xna', true, ARRAY['ROLE_EXECUTOR', 'ROLE_USER']),
            ('0c1cc9fb-50a7-4b15-a765-2251c0633004'::uuid, 'pavel.finance@example.com', '$2b$12$5VVQzB/Ql6.QkMXXC2t.VeLI1BcKuLa/r3jw7vjwHvxMWv9kUkgUq', true, ARRAY['ROLE_FINANCE_MANAGER', 'ROLE_USER']),
            ('6fda31ff-7b74-4ba0-9188-8d6504b63005'::uuid, 'olga.lead@example.com', '$2b$12$zT9uqQixIrNSoqEOg2Hcau5.l7un510vPXimYo2TVhsJzBxr3lEbq', true, ARRAY['ROLE_TEAM_LEAD', 'ROLE_SALES_AGENT', 'ROLE_USER'])
    ) AS v(id, email, password_hash, enabled, roles)
),
upsert_users AS (
    INSERT INTO auth.users (id, email, password_hash, enabled)
    SELECT id, email, password_hash, enabled FROM user_source
    ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            enabled = EXCLUDED.enabled,
            updated_at = timezone('utc', now())
    RETURNING email, id
),
resolved_users AS (
    SELECT u.id, us.roles
    FROM user_source us
    JOIN auth.users u ON u.email = us.email
)
INSERT INTO auth.user_roles (user_id, role_id)
SELECT ru.id, rm.id
FROM resolved_users ru
CROSS JOIN LATERAL unnest(ru.roles) AS role_alias(role_name)
JOIN role_map rm ON rm.name = role_alias.role_name
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
