SET search_path TO payments;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_type VARCHAR(32) REFERENCES payment_types(code);

CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);
