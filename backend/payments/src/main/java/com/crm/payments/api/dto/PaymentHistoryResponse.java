package com.crm.payments.api.dto;

import com.crm.payments.domain.PaymentStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public class PaymentHistoryResponse {

    private PaymentStatus status;
    private BigDecimal amount;
    private OffsetDateTime changedAt;
    private String description;

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

    public OffsetDateTime getChangedAt() {
        return changedAt;
    }

    public void setChangedAt(OffsetDateTime changedAt) {
        this.changedAt = changedAt;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
