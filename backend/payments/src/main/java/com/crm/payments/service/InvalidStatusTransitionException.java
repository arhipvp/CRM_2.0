package com.crm.payments.service;

import com.crm.payments.domain.PaymentStatus;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.BAD_REQUEST)
public class InvalidStatusTransitionException extends RuntimeException {

    private final PaymentStatus currentStatus;
    private final PaymentStatus targetStatus;

    public InvalidStatusTransitionException(PaymentStatus currentStatus, PaymentStatus targetStatus) {
        super(String.format("Invalid status transition from %s to %s", currentStatus, targetStatus));
        this.currentStatus = currentStatus;
        this.targetStatus = targetStatus;
    }

    public PaymentStatus getCurrentStatus() {
        return currentStatus;
    }

    public PaymentStatus getTargetStatus() {
        return targetStatus;
    }
}
