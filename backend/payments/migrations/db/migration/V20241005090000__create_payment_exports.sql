SET search_path TO payments;

CREATE TABLE IF NOT EXISTS payment_exports (
    id UUID PRIMARY KEY,
    status VARCHAR(32) NOT NULL,
    format VARCHAR(16) NOT NULL,
    filters TEXT NOT NULL,
    download_url TEXT,
    storage_path TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_exports_status ON payment_exports(status);
