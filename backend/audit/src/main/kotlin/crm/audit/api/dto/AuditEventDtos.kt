package crm.audit.api.dto

import crm.audit.domain.AuditEventEntity
import java.time.OffsetDateTime
import java.util.UUID

data class AuditEventResponse(
    val id: UUID,
    val eventId: String?,
    val eventType: String,
    val eventSource: String?,
    val occurredAt: OffsetDateTime,
    val payload: String?,
    val receivedAt: OffsetDateTime
)

data class AuditEventsPageResponse(
    val content: List<AuditEventResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int
)

fun AuditEventEntity.toResponse(): AuditEventResponse = AuditEventResponse(
    id = id,
    eventId = eventId,
    eventType = eventType,
    eventSource = eventSource,
    occurredAt = occurredAt,
    payload = payload,
    receivedAt = receivedAt
)
