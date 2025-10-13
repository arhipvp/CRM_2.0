package com.crm.audit.stream

import com.crm.audit.domain.AuditEventMessage
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
open class AuditEventProcessor {

    private val logger = LoggerFactory.getLogger(AuditEventProcessor::class.java)

    open fun process(event: AuditEventMessage) {
        logger.info(
            "Получено аудиторское событие type={}, id={}, source={}",
            event.eventType,
            event.eventId,
            event.source
        )
    }
}
