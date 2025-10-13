package com.crm.payments.repository;

import com.crm.payments.domain.PaymentScheduleEntity;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;

public interface PaymentScheduleRepository extends ReactiveCrudRepository<PaymentScheduleEntity, UUID> {

    Flux<PaymentScheduleEntity> findAllByDealIdAndDueDateAfterOrderByDueDateAsc(UUID dealId, LocalDate fromDate);
}
