package crm.audit.domain

import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table

@Table("audit_event_tags", schema = "audit")
data class AuditEventTagEntity(
    @Column("event_id")
    val eventId: UUID,
    @Column("event_occurred_at")
    val eventOccurredAt: OffsetDateTime,
    @Column("tag_key")
    val tagKey: String,
    @Column("tag_value")
    val tagValue: String?
)
