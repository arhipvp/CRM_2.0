CREATE SCHEMA IF NOT EXISTS payments;
SET search_path TO payments;

CREATE TABLE IF NOT EXISTS payment_statuses (
    code VARCHAR(32) PRIMARY KEY,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_types (
    code VARCHAR(32) PRIMARY KEY,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    deal_id UUID NOT NULL REFERENCES crm.deals(id),
    policy_id UUID REFERENCES crm.policies(id),
    initiator_user_id UUID NOT NULL REFERENCES auth.users(id),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' REFERENCES payment_statuses(code),
    due_date TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_deal_id ON payments(deal_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
