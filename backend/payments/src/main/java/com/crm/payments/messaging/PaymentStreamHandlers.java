package com.crm.payments.messaging;

import com.crm.payments.messaging.dto.PaymentQueueEvent;
import com.crm.payments.service.PaymentService;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Flux;

@Configuration
public class PaymentStreamHandlers {

    private static final Logger log = LoggerFactory.getLogger(PaymentStreamHandlers.class);

    @Bean
    public Consumer<Flux<PaymentQueueEvent>> paymentEventsConsumer(PaymentService paymentService) {
        return flux -> flux.flatMap(paymentService::handleQueueEvent)
                .doOnError(error -> log.error("Ошибка обработки события payments.events", error))
                .onErrorResume(error -> Flux.empty())
                .subscribe();
    }
}
