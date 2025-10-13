package com.crm.payments.repository;

import com.crm.payments.domain.PaymentHistoryEntity;
import java.util.UUID;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface PaymentHistoryRepository extends ReactiveCrudRepository<PaymentHistoryEntity, Long> {

    Flux<PaymentHistoryEntity> findAllByPaymentIdOrderByChangedAtAsc(UUID paymentId);
}
