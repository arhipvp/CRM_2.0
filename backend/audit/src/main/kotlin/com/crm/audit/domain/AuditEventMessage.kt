package com.crm.audit.domain

import com.fasterxml.jackson.databind.JsonNode
import java.time.Instant

/**
 * DTO для входящих аудиторских событий из RabbitMQ.
 */
data class AuditEventMessage(
    val eventId: String?,
    val eventType: String,
    val source: String?,
    val occurredAt: Instant,
    val payload: JsonNode?
)
