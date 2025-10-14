package crm.audit.stream

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import crm.audit.domain.AuditEventMessage
import java.time.Instant
import org.slf4j.LoggerFactory
import org.springframework.messaging.Message
import org.springframework.stereotype.Component

@Component
class AuditEventConsumer(
    private val processor: AuditEventProcessor,
    private val objectMapper: ObjectMapper
) {

    private val logger = LoggerFactory.getLogger(AuditEventConsumer::class.java)

    fun consume(queueName: String, message: Message<String>) {
        processMessage(queueName, message, fromDlq = false)
    }

    fun consumeDeadLetter(queueName: String, message: Message<String>) {
        processMessage(queueName, message, fromDlq = true)
    }

    private fun processMessage(queueName: String, message: Message<String>, fromDlq: Boolean) {
        val payload = message.payload
        val event = try {
            parseEvent(payload)
        } catch (ex: Exception) {
            if (fromDlq) {
                logger.error(
                    "Не удалось распарсить сообщение из DLQ {}: {}",
                    queueName,
                    payload,
                    ex
                )
                return
            } else {
                logger.error(
                    "Ошибка парсинга сообщения из очереди {}: {}",
                    queueName,
                    payload,
                    ex
                )
                throw AuditMessageProcessingException("Failed to parse message from queue $queueName", ex)
            }
        }

        try {
            processor.process(event)
            if (fromDlq) {
                logger.info(
                    "Повторно обработали сообщение из DLQ {}: type={}, id={}, source={}",
                    queueName,
                    event.eventType,
                    event.eventId,
                    event.source
                )
            }
        } catch (ex: Exception) {
            if (fromDlq) {
                logger.error(
                    "Не удалось повторно обработать сообщение из DLQ {}: type={}, id={}, source={}",
                    queueName,
                    event.eventType,
                    event.eventId,
                    event.source,
                    ex
                )
            } else {
                logger.error(
                    "Ошибка обработки сообщения из очереди {}: type={}, id={}, source={}",
                    queueName,
                    event.eventType,
                    event.eventId,
                    event.source,
                    ex
                )
                throw AuditMessageProcessingException("Failed to process message from queue $queueName", ex)
            }
        }
    }

    private fun parseEvent(payload: String): AuditEventMessage {
        val root = objectMapper.readTree(payload)
        val eventType = root["eventType"]?.asText()?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("eventType is required")
        val occurredAtText = root["occurredAt"]?.asText()?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("occurredAt is required")
        val occurredAt = Instant.parse(occurredAtText)
        val eventId = root["eventId"]?.asText()?.takeIf { it.isNotBlank() }
        val source = root["eventSource"]?.asText()?.takeIf { it.isNotBlank() }
            ?: root["source"]?.asText()?.takeIf { it.isNotBlank() }
        val payloadNode: JsonNode? = root.get("payload")

        return AuditEventMessage(
            eventId = eventId,
            eventType = eventType,
            source = source,
            occurredAt = occurredAt,
            payload = payloadNode
        )
    }
}

class AuditMessageProcessingException(message: String, cause: Throwable) : RuntimeException(message, cause)
