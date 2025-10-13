SET search_path TO payments;

CREATE TABLE IF NOT EXISTS payment_history (
    id BIGSERIAL PRIMARY KEY,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_history_payment_id ON payment_history(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_changed_at ON payment_history(changed_at);
