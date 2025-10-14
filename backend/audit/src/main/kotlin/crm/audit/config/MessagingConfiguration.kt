package crm.audit.config

import com.rabbitmq.client.Channel
import crm.audit.stream.AuditEventConsumer
import java.util.function.Consumer
import org.springframework.amqp.support.AmqpHeaders
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.messaging.Message

@Configuration
@EnableConfigurationProperties(AuditMessagingProperties::class)
class MessagingConfiguration(
    private val auditEventConsumer: AuditEventConsumer,
    private val messagingProperties: AuditMessagingProperties
) {

    @Bean
    fun auditEventsConsumer(): Consumer<Message<String>> = Consumer { message ->
        auditEventConsumer.consume(
            messagingProperties.eventsQueue,
            message,
            extractChannel(message),
            extractAckCallback(message),
            extractDeliveryTag(message)
        )
    }

    @Bean
    fun auditCoreConsumer(): Consumer<Message<String>> = Consumer { message ->
        auditEventConsumer.consume(
            messagingProperties.coreQueue,
            message,
            extractChannel(message),
            extractAckCallback(message),
            extractDeliveryTag(message)
        )
    }

    @Bean
    fun auditDlqConsumer(): Consumer<Message<String>> = Consumer { message ->
        auditEventConsumer.consumeDeadLetter(
            messagingProperties.dlq,
            message,
            extractChannel(message),
            extractAckCallback(message),
            extractDeliveryTag(message)
        )
    }

    private fun extractChannel(message: Message<String>): Channel? {
        return message.headers[AmqpHeaders.CHANNEL] as? Channel
    }

    private fun extractAckCallback(message: Message<String>): Any? {
        return message.headers["acknowledgmentCallback"]
            ?: message.headers["acknowledgementCallback"]
    }

    private fun extractDeliveryTag(message: Message<String>): Long? {
        val raw = message.headers[AmqpHeaders.DELIVERY_TAG] ?: return null
        return when (raw) {
            is Long -> raw
            is Int -> raw.toLong()
            is Number -> raw.toLong()
            else -> null
        }
    }
}
