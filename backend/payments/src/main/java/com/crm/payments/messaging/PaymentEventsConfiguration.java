package com.crm.payments.messaging;

import java.util.function.Consumer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Configuration
public class PaymentEventsConfiguration {

    private static final Logger log = LoggerFactory.getLogger(PaymentEventsConfiguration.class);

    @Bean
    public Consumer<Message<Object>> paymentEventsConsumer() {
        return message -> {
            Object payload = message.getPayload();
            log.debug("Получено событие оплаты: {}", payload);
        };
    }
}
