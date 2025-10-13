SET search_path TO payments;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS confirmation_reference VARCHAR(128);
