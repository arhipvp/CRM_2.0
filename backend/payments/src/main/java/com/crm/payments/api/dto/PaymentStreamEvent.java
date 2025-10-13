package com.crm.payments.api.dto;

import com.crm.payments.domain.PaymentStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public class PaymentStreamEvent {

    private String type;
    private UUID paymentId;
    private PaymentStatus status;
    private BigDecimal amount;
    private OffsetDateTime occurredAt;
    private UUID dealId;

    public PaymentStreamEvent() {
    }

    public PaymentStreamEvent(String type, UUID paymentId, PaymentStatus status, BigDecimal amount,
            OffsetDateTime occurredAt, UUID dealId) {
        this.type = type;
        this.paymentId = paymentId;
        this.status = status;
        this.amount = amount;
        this.occurredAt = occurredAt;
        this.dealId = dealId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public UUID getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(UUID paymentId) {
        this.paymentId = paymentId;
    }

    public PaymentStatus getStatus() {
        return status;
    }

    public void setStatus(PaymentStatus status) {
        this.status = status;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public OffsetDateTime getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(OffsetDateTime occurredAt) {
        this.occurredAt = occurredAt;
    }

    public UUID getDealId() {
        return dealId;
    }

    public void setDealId(UUID dealId) {
        this.dealId = dealId;
    }
}
