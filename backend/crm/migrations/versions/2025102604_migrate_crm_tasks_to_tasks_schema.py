"""Migrate legacy CRM tasks into tasks schema."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2025102604_migrate_crm_tasks_to_tasks_schema"
down_revision = "2025102603_allow_null_owner_in_clients"
branch_labels = None
depends_on = None

STATUS_MAPPING_CASE = """
        CASE t.status
            WHEN 'open' THEN 'pending'
            WHEN 'in_progress' THEN 'in_progress'
            WHEN 'done' THEN 'completed'
            WHEN 'completed' THEN 'completed'
            WHEN 'scheduled' THEN 'scheduled'
            WHEN 'cancelled' THEN 'cancelled'
            ELSE 'pending'
        END
"""

def upgrade() -> None:
    bind = op.get_bind()

    # Повторно убеждаемся, что схема tasks принадлежит текущему пользователю Alembic.
    # Если сменить владельца невозможно, помечаем миграцию как пропущенную и не
    # выполняем дальнейшие действия.
    op.execute(
        """
        DO $$
        DECLARE
            v_owner text := current_user;
            v_existing_owner text;
            v_can_assume_role boolean := false;
        BEGIN
            SELECT pg_get_userbyid(nspowner)
            INTO v_existing_owner
            FROM pg_namespace
            WHERE nspname = 'tasks';

            IF v_existing_owner IS NULL THEN
                BEGIN
                    EXECUTE format('CREATE SCHEMA IF NOT EXISTS tasks AUTHORIZATION %I', v_owner);
                EXCEPTION
                    WHEN insufficient_privilege THEN
                        PERFORM set_config('crm.migrate_tasks_to_tasks_schema.skip', '1', true);
                        RAISE NOTICE 'Skipping tasks migration: unable to create schema tasks as %', v_owner;
                        RETURN;
                END;
            ELSIF v_existing_owner <> v_owner THEN
                v_can_assume_role := pg_catalog.pg_has_role(current_user, v_existing_owner, 'MEMBER');

                IF NOT v_can_assume_role THEN
                    PERFORM set_config('crm.migrate_tasks_to_tasks_schema.skip', '1', true);
                    RAISE NOTICE 'Skipping tasks migration: current user % is not a member of tasks owner role %', v_owner, v_existing_owner;
                    RETURN;
                END IF;

                BEGIN
                    EXECUTE format('SET ROLE %I', v_existing_owner);
                    EXECUTE format('ALTER SCHEMA tasks OWNER TO %I', v_owner);
                    EXECUTE 'RESET ROLE';
                EXCEPTION
                    WHEN insufficient_privilege THEN
                        EXECUTE 'RESET ROLE';
                        PERFORM set_config('crm.migrate_tasks_to_tasks_schema.skip', '1', true);
                        RAISE NOTICE 'Skipping tasks migration: unable to alter schema tasks owner to %', v_owner;
                        RETURN;
                    WHEN others THEN
                        EXECUTE 'RESET ROLE';
                        RAISE;
                END;
            END IF;
        END;
        $$;
        """
    )

    skip_migration = bind.scalar(sa.text("SELECT current_setting('crm.migrate_tasks_to_tasks_schema.skip', true)"))
    if skip_migration == "1":
        return

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'crm' AND table_name = 'tasks'
            ) THEN
                PERFORM set_config('crm.migrate_tasks_to_tasks_schema.skip', '1', true);
                RAISE NOTICE 'crm.tasks отсутствует — миграцию пропускаем';
                RETURN;
            END IF;
        END;
        $$;
        """
    )

    skip_migration = bind.scalar(sa.text("SELECT current_setting('crm.migrate_tasks_to_tasks_schema.skip', true)"))
    if skip_migration == "1":
        return

    privileges = bind.execute(
        sa.text(
            """
            SELECT
                COALESCE(has_schema_privilege(current_user, 'tasks', 'USAGE'), false) AS tasks_schema_usage,
                COALESCE(has_table_privilege(current_user, 'tasks.tasks', 'SELECT'), false) AS tasks_tasks_select,
                COALESCE(has_table_privilege(current_user, 'tasks.tasks', 'INSERT'), false) AS tasks_tasks_insert,
                COALESCE(has_table_privilege(current_user, 'crm.tasks', 'SELECT'), false) AS crm_tasks_select,
                COALESCE(
                    (
                        SELECT pg_catalog.pg_has_role(current_user, c.relowner, 'MEMBER')
                        FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'crm' AND c.relname = 'tasks'
                    ),
                    false
                ) AS can_drop_crm_tasks
            """
        )
    ).mappings().one()

    has_data_privileges = (
        privileges["tasks_schema_usage"]
        and privileges["tasks_tasks_select"]
        and privileges["tasks_tasks_insert"]
        and privileges["crm_tasks_select"]
    )

    if not has_data_privileges:
        bind.execute(sa.text("SELECT set_config('crm.migrate_tasks_to_tasks_schema.skip', '1', true)"))
        op.execute(
            """
            DO $$
            BEGIN
                RAISE NOTICE 'Skipping tasks migration: current user lacks required SELECT/INSERT privileges.';
            END;
            $$;
            """
        )
        return

    bind.execute(
        sa.text(
            f"""
            INSERT INTO tasks.tasks (
                id,
                title,
                description,
                status_code,
                due_at,
                payload,
                assignee_id,
                author_id,
                deal_id,
                created_at,
                updated_at
            )
            SELECT
                t.id,
                t.title,
                t.description,
                {STATUS_MAPPING_CASE},
                CASE
                    WHEN t.due_date IS NOT NULL THEN timezone('UTC', t.due_date::timestamp)
                    ELSE NULL
                END,
                NULLIF(
                    jsonb_strip_nulls(
                        jsonb_build_object(
                            'priority', NULLIF(t.priority, ''),
                            'assigneeId', t.owner_id,
                            'authorId', t.owner_id,
                            'dealId', t.deal_id,
                            'clientId', t.client_id,
                            'legacyStatus', t.status,
                            'source', 'crm.tasks'
                        )
                    ),
                    '{{}}'::jsonb
                ),
                t.owner_id,
                t.owner_id,
                t.deal_id,
                t.created_at,
                t.updated_at
            FROM crm.tasks AS t
            WHERE NOT t.is_deleted
              AND NOT EXISTS (
                SELECT 1 FROM tasks.tasks AS existing WHERE existing.id = t.id
              );
            """
        )
    )

    if privileges["can_drop_crm_tasks"]:
        op.execute("DROP INDEX IF EXISTS crm.ix_tasks_owner")
        op.execute("DROP INDEX IF EXISTS crm.ix_tasks_tenant")
        op.execute("DROP INDEX IF EXISTS crm.ix_tasks_due_date")
        op.execute("DROP INDEX IF EXISTS crm.ix_tasks_status")
        op.execute("DROP TABLE IF EXISTS crm.tasks")
    else:
        op.execute(
            """
            DO $$
            BEGIN
                RAISE NOTICE 'Skipping cleanup of crm.tasks: current user is not a member of the legacy table owner role.';
            END;
            $$;
            """
        )


def downgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="open"),
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="normal"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', now())"),
        ),
        sa.ForeignKeyConstraint(["deal_id"], ["crm.deals.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["client_id"], ["crm.clients.id"], ondelete="SET NULL"),
        schema="crm",
    )

    op.execute("CREATE INDEX IF NOT EXISTS ix_tasks_status ON crm.tasks (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tasks_due_date ON crm.tasks (due_date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tasks_owner ON crm.tasks (owner_id)")

    op.execute(
        """
        INSERT INTO crm.tasks (
            id,
            owner_id,
            is_deleted,
            deal_id,
            client_id,
            title,
            description,
            status,
            priority,
            due_date,
            created_at,
            updated_at
        )
        SELECT
            t.id,
            COALESCE(t.assignee_id, NULLIF(t.payload->>'assigneeId', '')::uuid),
            false,
            t.deal_id,
            NULLIF(t.payload->>'clientId', '')::uuid,
            t.title,
            t.description,
            COALESCE(
                NULLIF(t.payload->>'legacyStatus', ''),
                CASE t.status_code
                    WHEN 'pending' THEN 'open'
                    WHEN 'completed' THEN 'done'
                    ELSE t.status_code
                END
            ),
            COALESCE(NULLIF(t.payload->>'priority', ''), 'normal'),
            CASE
                WHEN t.due_at IS NOT NULL THEN (t.due_at AT TIME ZONE 'UTC')::date
                ELSE NULL
            END,
            t.created_at,
            t.updated_at
        FROM tasks.tasks AS t
        WHERE NOT EXISTS (
            SELECT 1 FROM crm.tasks AS legacy WHERE legacy.id = t.id
        );
        """
    )
