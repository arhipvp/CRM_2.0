package com.crm.payments.config;

import com.crm.payments.api.dto.PaymentStreamEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Sinks;

@Configuration
public class PaymentStreamConfig {

    @Bean
    public Sinks.Many<PaymentStreamEvent> paymentEventsSink() {
        return Sinks.many().multicast().onBackpressureBuffer();
    }
}
