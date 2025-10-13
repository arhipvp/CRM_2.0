package com.crm.payments.service;

import com.crm.payments.domain.PaymentStatus;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class InvalidStatusTransitionException extends ResponseStatusException {

    private final PaymentStatus currentStatus;
    private final PaymentStatus targetStatus;

    public InvalidStatusTransitionException(PaymentStatus currentStatus, PaymentStatus targetStatus) {
        super(HttpStatus.BAD_REQUEST, "invalid_status_transition");
        this.currentStatus = currentStatus;
        this.targetStatus = targetStatus;
    }

    public PaymentStatus getCurrentStatus() {
        return currentStatus;
    }

    public PaymentStatus getTargetStatus() {
        return targetStatus;
    }

    @Override
    public String getMessage() {
        return "%s (from %s to %s)".formatted(super.getMessage(), currentStatus, targetStatus);
    }
}
