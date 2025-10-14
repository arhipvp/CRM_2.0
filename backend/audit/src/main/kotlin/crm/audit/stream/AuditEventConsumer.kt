package crm.audit.stream

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.rabbitmq.client.Channel
import crm.audit.domain.AuditEventMessage
import java.time.Instant
import org.slf4j.LoggerFactory
import org.springframework.amqp.support.AmqpHeaders
import org.springframework.messaging.Message
import org.springframework.stereotype.Component

@Component
class AuditEventConsumer(
    private val processor: AuditEventProcessor,
    private val objectMapper: ObjectMapper
) {

    private val logger = LoggerFactory.getLogger(AuditEventConsumer::class.java)

    fun consume(
        queueName: String,
        message: Message<String>,
        channel: Channel?,
        ackCallback: Any?,
        deliveryTag: Long?
    ) {
        processMessage(
            queueName,
            message,
            fromDlq = false,
            channel = channel,
            ackCallback = ackCallback,
            deliveryTag = deliveryTag
        )
    }

    fun consumeDeadLetter(
        queueName: String,
        message: Message<String>,
        channel: Channel?,
        ackCallback: Any?,
        deliveryTag: Long?
    ) {
        processMessage(
            queueName,
            message,
            fromDlq = true,
            channel = channel,
            ackCallback = ackCallback,
            deliveryTag = deliveryTag
        )
    }

    private fun processMessage(
        queueName: String,
        message: Message<String>,
        fromDlq: Boolean,
        channel: Channel?,
        ackCallback: Any?,
        deliveryTag: Long?
    ) {
        val payload = message.payload
        val messageId = message.headers[AmqpHeaders.MESSAGE_ID]?.toString()?.takeIf { it.isNotBlank() }
        val event = try {
            parseEvent(payload).copy(messageId = messageId)
        } catch (ex: Exception) {
            if (fromDlq) {
                logger.error(
                    "Не удалось распарсить сообщение из DLQ {} (messageId={}, deliveryTag={}): {}",
                    queueName,
                    messageId,
                    deliveryTag,
                    payload,
                    ex
                )
                return
            } else {
                logger.error(
                    "Ошибка парсинга сообщения из очереди {} (messageId={}, deliveryTag={}): {}",
                    queueName,
                    messageId,
                    deliveryTag,
                    payload,
                    ex
                )
                throw AuditMessageProcessingException("Failed to parse message from queue $queueName", ex)
            }
        }

        try {
            processor.process(event)
            acknowledge(queueName, channel, ackCallback, deliveryTag, event, fromDlq)
            if (fromDlq) {
                logger.info(
                    "Повторно обработали сообщение из DLQ {}: type={}, id={}, source={}, messageId={}",
                    queueName,
                    event.eventType,
                    event.eventId,
                    event.source,
                    event.messageId
                )
            }
        } catch (ex: Exception) {
            if (fromDlq) {
                logger.error(
                    "Не удалось повторно обработать сообщение из DLQ {}: type={}, id={}, source={}, messageId={}",
                    queueName,
                    event.eventType,
                    event.eventId,
                    event.source,
                    event.messageId,
                    ex
                )
            } else {
                logger.error(
                    "Ошибка обработки сообщения из очереди {}: type={}, id={}, source={}, messageId={}",
                    queueName,
                    event.eventType,
                    event.eventId,
                    event.source,
                    event.messageId,
                    ex
                )
                throw AuditMessageProcessingException("Failed to process message from queue $queueName", ex)
            }
        }
    }

    private fun acknowledge(
        queueName: String,
        channel: Channel?,
        ackCallback: Any?,
        deliveryTag: Long?,
        event: AuditEventMessage,
        fromDlq: Boolean
    ) {
        if (ackCallback != null && tryAcknowledgeCallback(queueName, ackCallback, event, fromDlq)) {
            return
        }

        if (channel == null || deliveryTag == null) {
            logger.debug(
                "Нет данных для подтверждения сообщения из очереди {} (channel={}, deliveryTag={}, messageId={}, fromDlq={})",
                queueName,
                channel,
                deliveryTag,
                event.messageId,
                fromDlq
            )
            return
        }

        try {
            channel.basicAck(deliveryTag, false)
            logger.debug(
                "Подтвердили сообщение из очереди {}: deliveryTag={}, messageId={}, fromDlq={}",
                queueName,
                deliveryTag,
                event.messageId,
                fromDlq
            )
        } catch (ackException: Exception) {
            logger.error(
                "Не удалось подтвердить сообщение из очереди {}: deliveryTag={}, messageId={}, fromDlq={}",
                queueName,
                deliveryTag,
                event.messageId,
                fromDlq,
                ackException
            )
            throw ackException
        }
    }

    private fun tryAcknowledgeCallback(
        queueName: String,
        ackCallback: Any,
        event: AuditEventMessage,
        fromDlq: Boolean
    ): Boolean {
        return try {
            val acknowledgeMethod = ackCallback.javaClass.methods.firstOrNull { it.name == "acknowledge" }
                ?: return false
            when (acknowledgeMethod.parameterCount) {
                0 -> {
                    acknowledgeMethod.invoke(ackCallback)
                    logger.debug(
                        "Подтвердили сообщение через AcknowledgmentCallback из очереди {}: messageId={}, fromDlq={}",
                        queueName,
                        event.messageId,
                        fromDlq
                    )
                    true
                }
                1 -> {
                    val statusType = acknowledgeMethod.parameterTypes.first()
                    val acceptValue = statusType.enumConstants?.firstOrNull { it.toString().equals("ACCEPT", ignoreCase = true) }
                        ?: return false
                    acknowledgeMethod.invoke(ackCallback, acceptValue)
                    logger.debug(
                        "Подтвердили сообщение через AcknowledgmentCallback из очереди {}: messageId={}, fromDlq={}",
                        queueName,
                        event.messageId,
                        fromDlq
                    )
                    true
                }
                else -> false
            }
        } catch (ackEx: Exception) {
            logger.warn(
                "Не удалось подтвердить сообщение через AcknowledgmentCallback из очереди {}: messageId={}, fromDlq={}",
                queueName,
                event.messageId,
                fromDlq,
                ackEx
            )
            false
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
