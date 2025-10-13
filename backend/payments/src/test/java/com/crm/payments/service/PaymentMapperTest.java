package com.crm.payments.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.crm.payments.api.dto.PaymentRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class PaymentMapperTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void shouldRejectNonRubCurrency() {
        PaymentRequest request = new PaymentRequest();
        request.setDealId(UUID.randomUUID());
        request.setInitiatorUserId(UUID.randomUUID());
        request.setAmount(BigDecimal.ONE);
        request.setCurrency("USD");

        Set<ConstraintViolation<PaymentRequest>> violations = validator.validate(request);

        assertThat(violations).hasSize(1);
        ConstraintViolation<PaymentRequest> violation = violations.iterator().next();
        assertThat(violation.getPropertyPath().toString()).isEqualTo("currency");
        assertThat(violation.getMessage()).contains("RUB");
    }
}

