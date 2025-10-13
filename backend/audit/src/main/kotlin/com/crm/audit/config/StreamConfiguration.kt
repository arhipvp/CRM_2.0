package com.crm.audit.config

import com.crm.audit.domain.AuditEventMessage
import com.crm.audit.stream.AuditEventProcessor
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.util.function.Consumer

@Configuration
class StreamConfiguration(
    private val processor: AuditEventProcessor
) {

    @Bean
    fun auditEventConsumer(): Consumer<AuditEventMessage> = Consumer { event ->
        processor.process(event)
    }
}
