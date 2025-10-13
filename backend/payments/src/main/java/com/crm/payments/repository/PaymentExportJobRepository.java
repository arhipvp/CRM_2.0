package com.crm.payments.repository;

import com.crm.payments.domain.PaymentExportJobEntity;
import java.util.UUID;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;

public interface PaymentExportJobRepository extends ReactiveCrudRepository<PaymentExportJobEntity, UUID> {
}
