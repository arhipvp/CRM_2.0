# Payment Types, DTOs, and Schemas - Complete Backend Reference

This document provides comprehensive reference of all Payment-related types, DTOs, and schemas in the backend codebase.

## Overview

The backend has two parallel Payment implementations:
1. **Python Backend (FastAPI)** - in `backend/crm` using Pydantic schemas and SQLAlchemy models
2. **Java Backend (Spring Boot)** - in `backend/payments` using Spring Data and Java DTOs

---

## PYTHON BACKEND (FastAPI)

### Locations
- Schemas: `backend/crm/crm/domain/schemas.py` (lines 701-880)
- Models: `backend/crm/crm/infrastructure/models.py` (lines 341-425)
- Service: `backend/crm/crm/domain/services.py` (lines 912+)
- Endpoints: `backend/crm/crm/api/routers/payments.py`

### Database Models

**Payment** (Main Entity):
- id (UUID, primary key)
- deal_id, policy_id (UUIDs with FK)
- sequence (int, unique with policy_id)
- status (str, default "scheduled")
- planned_date, actual_date (optional dates)
- planned_amount (Decimal 14,2)
- currency (str, max 12)
- comment (str, max 500)
- recorded_by_id, created_by_id, updated_by_id (UUIDs)
- incomes_total, expenses_total, net_total (Decimal 14,2)
- created_at, updated_at (datetime)
- is_deleted (bool)
- Relationships: incomes[], expenses[] (cascade delete)

**PaymentIncome**:
- id, payment_id (UUID)
- amount (Decimal 14,2)
- currency (str)
- category (str, max 64)
- posted_at (date)
- note (str, max 300)
- created_by_id, updated_by_id (UUID)
- timestamps and soft delete

**PaymentExpense** (Same structure as PaymentIncome)

### Pydantic Schemas

**PaymentBase**:
- planned_date: Optional[date]
- planned_amount: Decimal (must be > 0)
- currency: str (normalized to uppercase)
- comment: Optional[str]
- actual_date: Optional[date]
- recorded_by_id: Optional[UUID]

**PaymentCreate** extends PaymentBase:
- created_by_id: Optional[UUID]

**PaymentUpdate**:
- All fields optional
- Validators for amount > 0, currency normalization

**PaymentRead** (Response):
- All fields from PaymentBase
- id, deal_id, policy_id, sequence, status, is_deleted
- created_by_id, updated_by_id
- incomes_total, expenses_total, net_total (JSON serialized as "XX.XX")
- created_at, updated_at
- incomes: list[PaymentIncomeRead]
- expenses: list[PaymentExpenseRead]

**PaymentList**:
- items: list[PaymentRead]
- total: int

**PaymentIncomeBase**:
- amount: Decimal (must be > 0)
- currency: str (normalized)
- category: str
- posted_at: date
- note: Optional[str]

**PaymentIncomeCreate/Update**: Same pattern as Payment

**PaymentIncomeRead**:
- All base fields plus id, payment_id, timestamps, soft delete

**PaymentExpenseCreate/Update/Read**: Mirror of Income

### Service Methods (PaymentService)

- list_payments(deal_id, policy_id, include, statuses, limit, offset) -> PaymentList
- create_payment(deal_id, policy_id, payload) -> PaymentRead
- get_payment(deal_id, policy_id, payment_id, include) -> PaymentRead | None
- update_payment(deal_id, policy_id, payment_id, payload) -> PaymentRead | None
- delete_payment(deal_id, policy_id, payment_id) -> bool
- create_income(deal_id, policy_id, payment_id, payload) -> (PaymentRead, PaymentIncomeRead)
- update_income(deal_id, policy_id, payment_id, income_id, payload) -> (PaymentRead, PaymentIncomeRead)
- delete_income(...) -> PaymentRead | None

### API Endpoints

```
GET /deals/{deal_id}/policies/{policy_id}/payments
  Query: include[]=[incomes|expenses], status[], limit (1-200), offset (>=0)
  Response: PaymentList

POST /deals/{deal_id}/policies/{policy_id}/payments
  Body: PaymentCreate
  Response: PaymentRead (201)

GET /deals/{deal_id}/policies/{policy_id}/payments/{payment_id}
  Query: include[]
  Response: PaymentRead (404 if not found)

PATCH /deals/{deal_id}/policies/{policy_id}/payments/{payment_id}
  Body: PaymentUpdate
  Response: PaymentRead (404 if not found)

DELETE /deals/{deal_id}/policies/{policy_id}/payments/{payment_id}
  Response: 204 (404 if not found)
```

### Status Values (Python)

- "scheduled" - default
- "paid" - completed
- "cancelled" - cancelled
- "overdue" - computed

---

## JAVA BACKEND (Spring Boot)

### Locations
- DTOs: `backend/payments/src/main/java/com/crm/payments/api/dto/`
- Domain: `backend/payments/src/main/java/com/crm/payments/domain/`
- Controllers: `backend/payments/src/main/java/com/crm/payments/api/`

### Enums

**PaymentStatus**: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED

**PaymentType**: INITIAL, INSTALLMENT, COMMISSION, REFUND

### PaymentEntity

Fields:
- id (UUID)
- dealId, policyId, initiatorUserId (UUID)
- amount (BigDecimal)
- currency (String)
- status (PaymentStatus)
- paymentType (PaymentType)
- dueDate, processedAt (OffsetDateTime)
- confirmationReference (String)
- description (String)
- createdAt, updatedAt (OffsetDateTime)

### Request DTOs

**PaymentRequest** (Create):
- dealId (UUID, @NotNull)
- policyId (UUID)
- initiatorUserId (UUID, @NotNull)
- amount (BigDecimal, @NotNull, > 0)
- currency (String, @NotNull, must be "RUB")
- dueDate (OffsetDateTime)
- paymentType (PaymentType, @NotNull)
- description (String)

**UpdatePaymentRequest**:
- amount (BigDecimal, > 0 if provided)
- currency (String, must be "RUB")
- dueDate, processedAt (OffsetDateTime)
- paymentType (PaymentType)
- description (String, max 1024)
- comment (String, max 1024)
- updatedAt (OffsetDateTime)

**PaymentStatusRequest**:
- status (PaymentStatus, @NotNull)
- actualDate (OffsetDateTime, @PastOrPresent)
- confirmationReference (String, max 128)
- comment (String, max 1024)

**PaymentListRequest**:
- dealId, policyId (UUID)
- statuses, types (List)
- fromDate, toDate (OffsetDateTime)
- limit (Integer, 1-200, default 50)
- offset (Integer, >= 0)
- Methods: getResolvedLimit(), getResolvedOffset(), isDateRangeValid()

### Response DTOs

**PaymentResponse**:
- id, dealId, policyId, initiatorUserId (UUID)
- amount (BigDecimal)
- currency (String)
- status (PaymentStatus)
- paymentType (PaymentType)
- dueDate, processedAt (OffsetDateTime)
- confirmationReference (String)
- description (String)
- createdAt, updatedAt (OffsetDateTime)
- history (List<PaymentHistoryResponse>)

**PaymentHistoryResponse**:
- status (PaymentStatus)
- amount (BigDecimal)
- changedAt (OffsetDateTime)
- description (String)

**PaymentStreamEvent** (Server-Sent Events):
- type (String)
- paymentId (UUID)
- status (PaymentStatus)
- amount (BigDecimal)
- occurredAt (OffsetDateTime)
- dealId (UUID)

### REST API Endpoints (Java)

```
GET /api/v1|/api/payments
POST /api/v1|/api/payments
GET /api/v1|/api/payments/{paymentId}
PATCH /api/v1|/api/payments/{paymentId}
POST /api/v1|/api/payments/{paymentId}/status
GET /api/v1|/api/streams/payments (Server-Sent Events)
GET /api/v1|/api/payments/export
GET /api/v1|/api/payments/export/{jobId}
```

---

## Key Differences

| Aspect | Python | Java |
|--------|--------|------|
| Status | String enum | PaymentStatus enum |
| Types | N/A | PaymentType enum |
| Dates | date, datetime | OffsetDateTime |
| Amount | Decimal | BigDecimal |
| Currency | Any, normalized | "RUB" only |
| Transactions | Full models | History responses |
| Streaming | None | Server-Sent Events |
| Validation | Pydantic | Jakarta annotations |

---

## Validation Rules

### Both
- amount > 0
- limit 1-200, offset >= 0
- currency normalized/validated

### Python
- actual_date >= planned_date
- actual_date not in future
- cannot delete with transactions (unless paid/cancelled)
- Decimal serialized as "XX.XX"

### Java
- currency must be "RUB"
- actualDate <= today
- Server-Sent Events support
- Export functionality
