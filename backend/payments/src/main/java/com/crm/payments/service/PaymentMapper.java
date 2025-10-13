package com.crm.payments.service;

import com.crm.payments.api.dto.PaymentRequest;
import com.crm.payments.api.dto.PaymentResponse;
import com.crm.payments.domain.PaymentEntity;
import com.crm.payments.domain.PaymentStatus;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class PaymentMapper {

    public PaymentEntity fromRequest(PaymentRequest request) {
        PaymentEntity entity = new PaymentEntity();
        entity.setId(UUID.randomUUID());
        entity.setDealId(request.getDealId());
        entity.setPolicyId(request.getPolicyId());
        entity.setInitiatorUserId(request.getInitiatorUserId());
        entity.setAmount(request.getAmount());
        entity.setCurrency(request.getCurrency());
        entity.setStatus(PaymentStatus.PENDING);
        entity.setPaymentType(request.getPaymentType());
        entity.setDueDate(request.getDueDate());
        entity.setDescription(request.getDescription());
        OffsetDateTime now = OffsetDateTime.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    public PaymentResponse toResponse(PaymentEntity entity) {
        PaymentResponse response = new PaymentResponse();
        response.setId(entity.getId());
        response.setDealId(entity.getDealId());
        response.setPolicyId(entity.getPolicyId());
        response.setInitiatorUserId(entity.getInitiatorUserId());
        response.setAmount(entity.getAmount());
        response.setCurrency(entity.getCurrency());
        response.setStatus(entity.getStatus());
        response.setPaymentType(entity.getPaymentType());
        response.setDueDate(entity.getDueDate());
        response.setProcessedAt(entity.getProcessedAt());
        response.setDescription(entity.getDescription());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }
}
