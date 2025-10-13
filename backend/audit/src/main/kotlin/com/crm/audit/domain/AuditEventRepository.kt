package com.crm.audit.domain

import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.data.repository.kotlin.CoroutineCrudRepository

interface AuditEventRepository : CoroutineCrudRepository<AuditEventEntity, UUID> {

    suspend fun findByEventId(eventId: String): AuditEventEntity?

    suspend fun findByEventTypeAndOccurredAtAndEventSource(
        eventType: String,
        occurredAt: OffsetDateTime,
        eventSource: String?
    ): AuditEventEntity?
}
