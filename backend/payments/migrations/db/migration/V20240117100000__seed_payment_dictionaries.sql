SET search_path TO payments;

INSERT INTO payment_statuses (code, description) VALUES
    ('PENDING', 'Платёж ожидает подтверждения'),
    ('PROCESSING', 'Платёж в обработке'),
    ('COMPLETED', 'Платёж завершён'),
    ('FAILED', 'Платёж отклонён или завершился ошибкой'),
    ('CANCELLED', 'Платёж отменён клиентом или системой')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO payment_types (code, description) VALUES
    ('INITIAL', 'Первоначальный платёж по сделке'),
    ('INSTALLMENT', 'Регулярный платёж по рассрочке'),
    ('COMMISSION', 'Комиссия или сбор CRM'),
    ('REFUND', 'Возврат клиенту')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;
