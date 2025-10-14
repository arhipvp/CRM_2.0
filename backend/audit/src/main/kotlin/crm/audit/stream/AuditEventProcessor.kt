package crm.audit.stream

import crm.audit.domain.AuditEventEntity
import crm.audit.domain.AuditEventMessage
import crm.audit.domain.AuditEventRepository
import crm.audit.domain.AuditEventTagEntity
import crm.audit.domain.AuditEventTagRepository
import com.fasterxml.jackson.databind.JsonNode
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import org.slf4j.LoggerFactory
import org.springframework.dao.DuplicateKeyException
import org.springframework.stereotype.Component
import kotlinx.coroutines.runBlocking

@Component
open class AuditEventProcessor(
    private val repository: AuditEventRepository,
    private val tagRepository: AuditEventTagRepository
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

            try {
                val saved = repository.save(entity)
                val tags = extractTags(saved.id, event.payload)
                if (tags.isNotEmpty()) {
                    tagRepository.saveAll(tags)
                }
                logger.debug(
                    "Событие сохранено type={}, id={}, source={}, occurredAt={}",
                    event.eventType,
                    event.eventId,
                    event.source,
                    entity.occurredAt
                )
            } catch (duplicate: DuplicateKeyException) {
                logger.debug(
                    "Повторная доставка события type={}, id={}, source={} — запись уже существует",
                    event.eventType,
                    event.eventId,
                    event.source,
                    duplicate
                )
            }
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

    @Suppress("DEPRECATION")
    private fun extractTags(eventId: UUID, payload: JsonNode?): List<AuditEventTagEntity> {
        if (payload == null) {
            return emptyList()
        }

        val tagsNode = when {
            payload.has("tags") -> payload.get("tags")
            payload.has("attributes") -> payload.get("attributes")
            else -> null
        }

        if (tagsNode == null || !tagsNode.isObject) {
            return emptyList()
        }

        val result = mutableListOf<AuditEventTagEntity>()
        val fields = tagsNode.fields()
        while (fields.hasNext()) {
            val (key, value) = fields.next()
            val normalizedValue = when {
                value.isNull -> null
                value.isValueNode -> value.asText()
                else -> value.toString()
            }
            result += AuditEventTagEntity(
                eventId = eventId,
                tagKey = key,
                tagValue = normalizedValue
            )
        }

        return result
    }
}
