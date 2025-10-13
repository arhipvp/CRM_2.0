package com.crm.payments.config;

import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.ExchangeBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PaymentsMessagingConfiguration {

    public static final String PAYMENTS_EVENTS_EXCHANGE = "payments.events";

    @Bean
    public Declarables paymentsEventsExchangeDeclarable() {
        TopicExchange exchange = ExchangeBuilder
            .topicExchange(PAYMENTS_EVENTS_EXCHANGE)
            .durable(true)
            .build();
        return new Declarables(exchange);
    }
}
