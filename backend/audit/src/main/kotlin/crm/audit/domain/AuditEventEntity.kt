package crm.audit.domain

import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.data.annotation.Id
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table

@Table("audit_events", schema = "audit")
data class AuditEventEntity(
    @Id
    val id: UUID = UUID.randomUUID(),
    @Column("event_id")
    val eventId: String? = null,
    @Column("event_type")
    val eventType: String,
    @Column("event_source")
    val eventSource: String?,
    @Column("occurred_at")
    val occurredAt: OffsetDateTime,
    @Column("payload")
    val payload: String?,
    @Column("received_at")
    val receivedAt: OffsetDateTime
)
