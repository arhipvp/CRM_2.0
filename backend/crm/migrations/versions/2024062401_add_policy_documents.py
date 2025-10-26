"""Create policy documents table"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def _schema_exists(connection, schema: str) -> bool:
    result = connection.execute(
        sa.text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.schemata
                WHERE schema_name = :schema
            )
            """
        ),
        {"schema": schema},
    )
    return bool(result.scalar())


def _table_exists(connection, schema: str, table_name: str) -> bool:
    result = connection.execute(
        sa.text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = :schema AND table_name = :table_name
            )
            """
        ),
        {"schema": schema, "table_name": table_name},
    )
    return bool(result.scalar())


def _constraint_exists(
    connection, schema: str, table_name: str, constraint_name: str
) -> bool:
    result = connection.execute(
        sa.text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE table_schema = :schema
                  AND table_name = :table_name
                  AND constraint_name = :constraint_name
            )
            """
        ),
        {
            "schema": schema,
            "table_name": table_name,
            "constraint_name": constraint_name,
        },
    )
    return bool(result.scalar())


revision = "2024062401_add_policy_documents"
down_revision = "2024062001_add_deal_journal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "policy_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        schema="crm",
    )
    op.create_index(
        "ix_policy_documents_tenant_id",
        "policy_documents",
        ["tenant_id"],
        schema="crm",
    )
    op.create_index(
        "ix_policy_documents_policy_id",
        "policy_documents",
        ["policy_id"],
        schema="crm",
    )
    op.create_index(
        "ix_policy_documents_document_id",
        "policy_documents",
        ["document_id"],
        schema="crm",
    )
    op.create_unique_constraint(
        "ux_policy_documents_policy_document",
        "policy_documents",
        ["policy_id", "document_id"],
        schema="crm",
    )
    op.create_foreign_key(
        "fk_policy_documents_policy_id",
        "policy_documents",
        "policies",
        ["policy_id"],
        ["id"],
        source_schema="crm",
        referent_schema="crm",
        ondelete="CASCADE",
    )
    bind = op.get_bind()
    if _schema_exists(bind, "documents") and _table_exists(
        bind, "documents", "documents"
    ):
        op.create_foreign_key(
            "fk_policy_documents_document_id",
            "policy_documents",
            "documents",
            ["document_id"],
            ["id"],
            source_schema="crm",
            referent_schema="documents",
            ondelete="CASCADE",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _constraint_exists(
        bind, "crm", "policy_documents", "fk_policy_documents_document_id"
    ):
        op.drop_constraint(
            "fk_policy_documents_document_id",
            "policy_documents",
            schema="crm",
            type_="foreignkey",
        )
    op.drop_constraint(
        "fk_policy_documents_policy_id",
        "policy_documents",
        schema="crm",
        type_="foreignkey",
    )
    op.drop_constraint(
        "ux_policy_documents_policy_document",
        "policy_documents",
        schema="crm",
        type_="unique",
    )
    op.drop_index(
        "ix_policy_documents_document_id",
        table_name="policy_documents",
        schema="crm",
    )
    op.drop_index(
        "ix_policy_documents_policy_id",
        table_name="policy_documents",
        schema="crm",
    )
    op.drop_index(
        "ix_policy_documents_tenant_id",
        table_name="policy_documents",
        schema="crm",
    )
    op.drop_table("policy_documents", schema="crm")
