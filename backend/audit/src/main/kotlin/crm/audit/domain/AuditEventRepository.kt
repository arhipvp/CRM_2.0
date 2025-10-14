package crm.audit.domain

import java.time.OffsetDateTime
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import org.springframework.data.r2dbc.repository.Query
import org.springframework.data.repository.kotlin.CoroutineCrudRepository

interface AuditEventRepository : CoroutineCrudRepository<AuditEventEntity, UUID> {

    suspend fun findByMessageId(messageId: String): AuditEventEntity?

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

    @Query(
        """
        SELECT *
        FROM audit.audit_events
        WHERE (:eventType IS NULL OR event_type = :eventType)
          AND (:occurredAfter IS NULL OR occurred_at >= :occurredAfter)
          AND (:occurredBefore IS NULL OR occurred_at <= :occurredBefore)
        ORDER BY occurred_at DESC, received_at DESC
        LIMIT :limit OFFSET :offset
        """
    )
    fun findEvents(
        eventType: String?,
        occurredAfter: OffsetDateTime?,
        occurredBefore: OffsetDateTime?,
        limit: Int,
        offset: Long
    ): Flow<AuditEventEntity>

    @Query(
        """
        SELECT COUNT(*)
        FROM audit.audit_events
        WHERE (:eventType IS NULL OR event_type = :eventType)
          AND (:occurredAfter IS NULL OR occurred_at >= :occurredAfter)
          AND (:occurredBefore IS NULL OR occurred_at <= :occurredBefore)
        """
    )
    suspend fun countEvents(
        eventType: String?,
        occurredAfter: OffsetDateTime?,
        occurredBefore: OffsetDateTime?
    ): Long
}
