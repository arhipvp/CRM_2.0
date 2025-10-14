package crm.audit.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "audit.messaging")
data class AuditMessagingProperties(
    val eventsQueue: String = "audit.events",
    val eventsGroup: String = "audit-service",
    val coreQueue: String = "audit.core",
    val coreGroup: String = "audit-service",
    val dlq: String = "audit.dlq",
    val dlqGroup: String = "audit-dlq-listener",
    val prefetch: Int = 50
)
