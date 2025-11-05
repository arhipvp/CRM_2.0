# Payment Schemas Quick Reference - Code Examples

## Summary of All Payment Types Found

### Python Backend Schemas (schemas.py lines 701-880)

Key schemas:
- PaymentBase (line 701)
- PaymentCreate (line 729)
- PaymentUpdate (line 733)
- PaymentRead (line 855)
- PaymentList (line 877)
- PaymentIncomeBase (line 763)
- PaymentIncomeCreate (line 790)
- PaymentIncomeUpdate (line 794)
- PaymentIncomeRead (line 835)
- PaymentExpenseBase (line 823)
- PaymentExpenseCreate (line 827)
- PaymentExpenseUpdate (line 831)
- PaymentExpenseRead (line 845)

### Database Models (models.py lines 341-425)

- Payment (line 341): Main payment entity with all fields
- PaymentIncome (line 387): Income transaction records
- PaymentExpense (line 407): Expense transaction records

### API Endpoints (payments.py)

Router path: /deals/{deal_id}/policies/{policy_id}/payments
- GET / (list with pagination)
- POST / (create)
- GET /{payment_id} (get single)
- PATCH /{payment_id} (update)
- DELETE /{payment_id} (soft delete)

### Java Backend DTOs

Enums:
- PaymentStatus: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
- PaymentType: INITIAL, INSTALLMENT, COMMISSION, REFUND

Request DTOs:
- PaymentRequest (create)
- UpdatePaymentRequest (update)
- PaymentStatusRequest (status update)
- PaymentListRequest (filtering)

Response DTOs:
- PaymentResponse (single payment)
- PaymentHistoryResponse (status history)
- PaymentStreamEvent (streaming events)

Controller endpoints:
- GET /api/v1|/api/payments
- POST /api/v1|/api/payments
- GET /api/v1|/api/payments/{paymentId}
- PATCH /api/v1|/api/payments/{paymentId}
- POST /api/v1|/api/payments/{paymentId}/status
- GET /api/v1|/api/streams/payments (Server-Sent Events)
- GET /api/v1|/api/payments/export
- GET /api/v1|/api/payments/export/{jobId}

## Field Reference

### Payment Core Fields (Both Backends)

Required:
- planned_amount: Decimal/BigDecimal (must be > 0)
- currency: String (uppercase, Java restricted to "RUB")

Optional:
- planned_date: Date
- actual_date: Date (must be >= planned_date and not future)
- comment/description: String
- recorded_by_id/initiator_user_id: UUID

Response/Computed:
- id, deal_id, policy_id: UUID
- sequence: Integer
- status: String (Python) or Enum (Java)
- incomes_total, expenses_total, net_total: Decimal/BigDecimal
- created_at, updated_at: Datetime
- is_deleted: Boolean (Python soft delete)

### Income/Expense Fields

Required:
- amount: Decimal/BigDecimal (> 0)
- currency: String
- category: String
- posted_at: Date

Optional:
- note: String

Response:
- id, payment_id: UUID
- created_by_id, updated_by_id: UUID
- created_at, updated_at: Datetime
- is_deleted: Boolean

## Validation Rules

All backends:
1. Amount must be positive
2. Limit 1-200 for pagination, offset >= 0
3. Currency normalized to uppercase

Python specific:
1. actual_date >= planned_date when both present
2. actual_date cannot be future
3. Cannot delete if has incomes/expenses (except paid/cancelled)
4. Decimals serialized as "XX.XX" strings

Java specific:
1. Currency restricted to "RUB"
2. actualDate must be past or present
3. Server-Sent Events streaming available
4. Export functionality available

## Complete File Locations

Python:
- C:\Dev\CRM_2.0\backend\crm\crm\domain\schemas.py
- C:\Dev\CRM_2.0\backend\crm\crm\infrastructure\models.py
- C:\Dev\CRM_2.0\backend\crm\crm\domain\services.py
- C:\Dev\CRM_2.0\backend\crm\crm\api\routers\payments.py

Java:
- C:\Dev\CRM_2.0\backend\payments\src\main\java\com\crm\payments\api\dto\
- C:\Dev\CRM_2.0\backend\payments\src\main\java\com\crm\payments\domain\
- C:\Dev\CRM_2.0\backend\payments\src\main\java\com\crm\payments\api\PaymentController.java
