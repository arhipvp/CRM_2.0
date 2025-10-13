package com.crm.audit.domain

import java.util.UUID
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table

@Table("audit_event_tags", schema = "audit")
data class AuditEventTagEntity(
    @Column("event_id")
    val eventId: UUID,
    @Column("tag_key")
    val tagKey: String,
    @Column("tag_value")
    val tagValue: String?
)
