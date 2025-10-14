# API спецификации

Каталог содержит документацию по REST/SSE интерфейсам микросервисов CRM. Для всех вызовов требуется JWT, выданный Auth, если не указано иное.

## Сервисы
- [Gateway / BFF](gateway.md)
- [Auth](auth.md)
- [CRM / Deals](crm-deals.md)
- [Платежи (CRM)](payments.md) — график платежей полиса, операции поступлений и расходов.
- [Tasks](tasks.md)
- [Notifications](notifications.md)
- [Documents](documents.md)
- [SSE-каналы](streams.md)

Каждый документ включает описание маршрутов, параметры, структуры запросов/ответов и перечень ошибок. Для асинхронных событий см. документ [`docs/integration-events.md`](../integration-events.md).
