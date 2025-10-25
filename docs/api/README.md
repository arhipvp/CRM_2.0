# API спецификации

Каталог содержит документацию по REST/SSE интерфейсам микросервисов CRM. Для всех вызовов требуется JWT, выданный Auth, если не указано иное.

## Сервисы
- [Gateway / BFF](gateway.md)
- [Auth](auth.md)
- [CRM / Deals](crm-deals.md)
- [Платежи (CRM)](payments.md) — график платежей полиса, операции поступлений и расходов; API обслуживается модулем CRM/Deals, а каталог `backend/payments` используется только как архив.
- [CRM Tasks](tasks.md)
- [CRM Notifications](notifications.md)
- [Documents](documents.md)
- [SSE-каналы](streams.md)

Каждый документ включает описание маршрутов, параметры, структуры запросов/ответов и перечень ошибок. Для асинхронных событий см. документ [`docs/integration-events.md`](../integration-events.md).
