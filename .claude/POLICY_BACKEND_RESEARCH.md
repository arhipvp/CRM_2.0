# POLICY-RELATED TYPES, DTOs, AND SCHEMAS - BACKEND SUMMARY

## QUICK REFERENCE

Policy Model (Database):
- id: UUID (PK)
- policy_number: str(1-64) - UNIQUE, client-provided (NO auto-generation)
- status: str(50) - default="draft", accepts any value (draft, active, inactive, suspended, expired)
- premium: float/Numeric(12,2) - NULLABLE
- effective_from: date - NULLABLE
- effective_to: date - NULLABLE
- client_id: UUID - FK(clients.id, RESTRICT)
- deal_id: UUID - NULLABLE, FK(deals.id, SET NULL)
- calculation_id: UUID - NULLABLE, FK(calculations.id, SET NULL)
- owner_id: UUID - NULLABLE, ownership tracking
- created_at, updated_at: datetime - auto server
- is_deleted: bool - soft delete flag

---

PYDANTIC SCHEMAS:

1. PolicyCreate - Request to create policy
   - client_id: UUID (required)
   - deal_id: UUID | None
   - owner_id: UUID (required)
   - policy_number: str (1-64) (required)
   - status: str = "draft"
   - premium: float | None
   - effective_from: date | None
   - effective_to: date | None

2. PolicyUpdate - Request to PATCH update policy
   - status: Optional[str]
   - premium: Optional[float]
   - effective_from: Optional[date]
   - effective_to: Optional[date]
   - is_deleted: Optional[bool]

3. PolicyRead - Response schema (all fields from database)
   - id, policy_number, status, premium
   - effective_from, effective_to
   - client_id, deal_id, calculation_id, owner_id
   - created_at, updated_at, is_deleted

---

API ENDPOINTS:

GET /api/v1/policies/ - List all
  Returns: list[PolicyRead]

POST /api/v1/policies/ - Create
  Body: PolicyCreate
  Returns: PolicyRead (201)

GET /api/v1/policies/{policy_id} - Get single
  Returns: PolicyRead
  Error: 404 if not found

PATCH /api/v1/policies/{policy_id} - Update
  Body: PolicyUpdate
  Returns: PolicyRead
  Error: 404 if not found

GET /api/v1/policies/{policy_id}/documents - List documents
  Returns: list[PolicyDocumentRead]

POST /api/v1/policies/{policy_id}/documents - Attach document
  Body: {document_id: UUID}
  Returns: PolicyDocumentRead (201)
  Error: 404, 409 (already linked)

DELETE /api/v1/policies/{policy_id}/documents/{document_id} - Detach
  Returns: 204 (no content)

---

POLICY NUMBER:
- NO automatic generation
- Client must provide unique value
- Constraints: min 1 char, max 64 chars
- Database: UNIQUE constraint
- Validation: Any string format accepted
- Examples: "PL-100", "2025-001-ABC", "POL-001-2025"

---

STATUS VALUES:
- draft (default) - Initial state
- active - Active policy
- inactive - Inactive
- suspended - Temporarily suspended
- expired - Expired
- Any custom string (no enum constraint)

---

RELATIONSHIPS:
Policy -> Client: Many-to-one, FK(client_id), RESTRICT
Policy -> Deal: Optional many-to-one, FK(deal_id), SET NULL
Policy -> Calculation: Optional one-to-one, FK(calculation_id), SET NULL
Policy -> Owner: owner_id field (UUID, no FK constraint)
Policy -> Documents: One-to-many, cascade delete

---

DEPRECATED FIELDS (NOT in backend):
- type (vehicle/insurance type) - use status instead
- startDate - use effective_from
- endDate - use effective_to
- carBrand - vehicle-specific, not in schema
- vin - vehicle-specific, not in schema

Backend schema is general-purpose, no vehicle-specific fields.

---

KEY MIGRATIONS:
- 2024031501: Initial table
- 2024062001: Add calculation_id column
- 2025102602: Add premium column

---

FILE LOCATIONS:
Models: backend/crm/crm/infrastructure/models.py (lines 124-175)
Schemas: backend/crm/crm/domain/schemas.py (lines 190-242)
Service: backend/crm/crm/domain/services.py (lines 175-243)
Repository: backend/crm/crm/infrastructure/repositories.py (lines 303-327)
Endpoints: backend/crm/crm/api/routers/policies.py (all file)
