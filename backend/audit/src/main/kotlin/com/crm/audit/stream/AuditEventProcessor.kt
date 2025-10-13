package com.crm.audit.stream

import com.crm.audit.domain.AuditEventEntity
import com.crm.audit.domain.AuditEventMessage
import com.crm.audit.domain.AuditEventRepository
import java.time.OffsetDateTime
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
open class AuditEventProcessor(
    private val repository: AuditEventRepository
) {

    private val logger = LoggerFactory.getLogger(AuditEventProcessor::class.java)

    open fun process(event: AuditEventMessage) {
        logger.info(
            "Получено аудиторское событие type={}, id={}, source={}",
            event.eventType,
            event.eventId,
            event.source
        )

        runBlocking {
            val occurredAt = event.occurredAt.atOffset(ZoneOffset.UTC)
            val existing = resolveExistingEvent(event, occurredAt)
            if (existing != null) {
                logger.debug(
                    "Событие уже сохранено type={}, id={}, source={} — пропускаем",
                    event.eventType,
                    event.eventId,
                    event.source
                )
                return@runBlocking
            }

            val entity = AuditEventEntity(
                eventId = event.eventId,
                eventType = event.eventType,
                eventSource = event.source,
                occurredAt = occurredAt,
                payload = event.payload?.toString(),
                receivedAt = OffsetDateTime.now(ZoneOffset.UTC)
            )

            repository.save(entity)
            logger.debug(
                "Событие сохранено type={}, id={}, source={}, occurredAt={}",
                event.eventType,
                event.eventId,
                event.source,
                entity.occurredAt
            )
        }
    }

    private suspend fun resolveExistingEvent(
        event: AuditEventMessage,
        occurredAt: OffsetDateTime
    ): AuditEventEntity? {
        return when {
            !event.eventId.isNullOrBlank() -> repository.findByEventId(event.eventId)
            else -> repository.findByEventTypeAndOccurredAtAndEventSource(
                event.eventType,
                occurredAt,
                event.source
            )
        }
    }
}
