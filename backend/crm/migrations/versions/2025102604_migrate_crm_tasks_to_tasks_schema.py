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
    # Повторно убеждаемся, что схема tasks принадлежит текущему пользователю Alembic.
    # Это критично для инсталляций, где первая миграция была применена частично
    # вручную или schema уже создана сторонними инструментами.
    op.execute(
        """
        DO $$
        DECLARE
            v_owner text := current_user;
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_namespace
                WHERE nspname = 'tasks'
            ) THEN
                EXECUTE format('ALTER SCHEMA tasks OWNER TO %I', v_owner);
            ELSE
                EXECUTE format('CREATE SCHEMA tasks AUTHORIZATION %I', v_owner);
            END IF;
        END;
        $$;
        """
    )

    op.execute(
        f"""
        DO $$
        DECLARE
            schema_owner text;
            migration_performed boolean := false;
        BEGIN
            SELECT pg_get_userbyid(nspowner)
              INTO schema_owner
              FROM pg_namespace
             WHERE nspname = 'tasks';

            IF schema_owner IS NULL THEN
                RAISE NOTICE 'Skipping tasks migration: schema tasks not found.';
                RETURN;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'tasks' AND table_name = 'tasks'
            ) THEN
                RAISE NOTICE 'Skipping tasks migration: table tasks.tasks not found.';
                RETURN;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'crm' AND table_name = 'tasks'
            ) THEN
                RAISE NOTICE 'Skipping tasks migration: table crm.tasks not found.';
                RETURN;
            END IF;

            IF NOT (has_schema_privilege(current_user, 'tasks', 'USAGE')
                AND has_table_privilege(current_user, 'tasks.tasks', 'SELECT')
                AND has_table_privilege(current_user, 'tasks.tasks', 'INSERT')) THEN
                RAISE NOTICE 'Skipping tasks migration: insufficient privileges for % on schema tasks owned by %.', current_user, schema_owner;
                RETURN;
            END IF;

            EXECUTE $insert$
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
            $insert$;

            migration_performed := true;

            IF migration_performed THEN
                EXECUTE 'DROP INDEX IF EXISTS crm.ix_tasks_owner';
                EXECUTE 'DROP INDEX IF EXISTS crm.ix_tasks_tenant';
                EXECUTE 'DROP INDEX IF EXISTS crm.ix_tasks_due_date';
                EXECUTE 'DROP INDEX IF EXISTS crm.ix_tasks_status';
                EXECUTE 'DROP TABLE IF EXISTS crm.tasks';
            END IF;
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
