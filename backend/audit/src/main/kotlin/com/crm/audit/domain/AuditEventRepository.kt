package com.crm.audit.domain

import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.data.r2dbc.repository.Query
import org.springframework.data.repository.kotlin.CoroutineCrudRepository

interface AuditEventRepository : CoroutineCrudRepository<AuditEventEntity, UUID> {

    suspend fun findByEventId(eventId: String): AuditEventEntity?

    @Query(
        """
        SELECT *
        FROM audit.audit_events
        WHERE event_type = :eventType
          AND occurred_at = :occurredAt
          AND (event_source = :eventSource OR (event_source IS NULL AND :eventSource IS NULL))
        LIMIT 1
        """
    )
    suspend fun findByEventTypeAndOccurredAtAndEventSource(
        eventType: String,
        occurredAt: OffsetDateTime,
        eventSource: String?
    ): AuditEventEntity?
}
