package com.crm.payments.repository;

import com.crm.payments.api.dto.PaymentListRequest;
import com.crm.payments.domain.PaymentEntity;
import reactor.core.publisher.Flux;

public interface PaymentRepositoryCustom {

    Flux<PaymentEntity> findAll(PaymentListRequest request);
}
