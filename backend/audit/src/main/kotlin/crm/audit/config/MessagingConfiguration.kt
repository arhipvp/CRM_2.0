package crm.audit.config

import crm.audit.stream.AuditEventConsumer
import java.util.function.Consumer
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
        auditEventConsumer.consume(messagingProperties.eventsQueue, message)
    }

    @Bean
    fun auditCoreConsumer(): Consumer<Message<String>> = Consumer { message ->
        auditEventConsumer.consume(messagingProperties.coreQueue, message)
    }

    @Bean
    fun auditDlqConsumer(): Consumer<Message<String>> = Consumer { message ->
        auditEventConsumer.consumeDeadLetter(messagingProperties.dlq, message)
    }
}
