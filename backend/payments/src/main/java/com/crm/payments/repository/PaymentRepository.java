package com.crm.payments.repository;

import com.crm.payments.domain.PaymentEntity;
import java.util.UUID;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface PaymentRepository extends ReactiveCrudRepository<PaymentEntity, UUID>, PaymentRepositoryCustom {

    Flux<PaymentEntity> findAllByDealId(UUID dealId);
}
