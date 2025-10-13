SET search_path TO payments;

CREATE TABLE IF NOT EXISTS payment_schedules (
    id UUID PRIMARY KEY,
    deal_id UUID NOT NULL REFERENCES crm.deals(id),
    payment_type VARCHAR(32) NOT NULL REFERENCES payment_types(code),
    due_date DATE NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_schedules UNIQUE (deal_id, payment_type, due_date)
);

CREATE INDEX IF NOT EXISTS idx_payment_schedules_deal_due ON payment_schedules(deal_id, due_date);
