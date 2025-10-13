-- psql -v reports_schema=${REPORTS_SCHEMA:-reports} -v crm_schema=${REPORTS_CRM_SCHEMA:-crm} -f 001_create_deal_pipeline_summary.sql
\set ON_ERROR_STOP on

DO $$
BEGIN
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', :'reports_schema');
END
$$;

DO $$
BEGIN
    EXECUTE format(
        'CREATE MATERIALIZED VIEW IF NOT EXISTS %1$I.deal_pipeline_summary AS
         SELECT
             d.status,
             COUNT(*)::bigint AS total_deals,
             COALESCE(SUM(d.value), 0)::numeric(12, 2) AS total_value,
             MIN(d.created_at) AS first_deal_at,
             MAX(d.updated_at) AS last_activity_at
         FROM %2$I.deals AS d
         WHERE d.is_deleted = false
         GROUP BY d.status',
        :'reports_schema',
        :'crm_schema'
    );
END
$$;

DO $$
BEGIN
    EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS %1$I_deal_pipeline_summary_status_idx
         ON %1$I.deal_pipeline_summary (status)',
        :'reports_schema'
    );
END
$$;
