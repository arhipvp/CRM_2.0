package com.crm.payments.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.crm.payments.api.dto.PaymentRequest;
import com.crm.payments.domain.PaymentEntity;
import com.crm.payments.domain.PaymentType;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class PaymentMapperTest {

    private static Validator validator;

    private final PaymentMapper mapper = new PaymentMapper();

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void fromRequestShouldPopulatePaymentType() {
        PaymentRequest request = new PaymentRequest();
        request.setDealId(UUID.randomUUID());
        request.setPolicyId(UUID.randomUUID());
        request.setInitiatorUserId(UUID.randomUUID());
        request.setAmount(BigDecimal.valueOf(1500));
        request.setCurrency("RUB");
        request.setDueDate(OffsetDateTime.now().plusDays(3).withNano(0));
        request.setDescription("Аванс по договору");
        request.setPaymentType(PaymentType.COMMISSION);

        PaymentEntity entity = mapper.fromRequest(request);

        assertThat(entity.getPaymentType()).isEqualTo(PaymentType.COMMISSION);
        assertThat(entity.getDealId()).isEqualTo(request.getDealId());
        assertThat(entity.getPolicyId()).isEqualTo(request.getPolicyId());
        assertThat(entity.getInitiatorUserId()).isEqualTo(request.getInitiatorUserId());
        assertThat(entity.getAmount()).isEqualByComparingTo(request.getAmount());
        assertThat(entity.getCurrency()).isEqualTo(request.getCurrency());
        assertThat(entity.getDueDate()).isEqualTo(request.getDueDate());
        assertThat(entity.getDescription()).isEqualTo(request.getDescription());
    }

    @Test
    void shouldRejectNonRubCurrency() {
        PaymentRequest request = new PaymentRequest();
        request.setDealId(UUID.randomUUID());
        request.setInitiatorUserId(UUID.randomUUID());
        request.setAmount(BigDecimal.ONE);
        request.setCurrency("USD");
        request.setPaymentType(PaymentType.COMMISSION);

        Set<ConstraintViolation<PaymentRequest>> violations = validator.validate(request);

        assertThat(violations).hasSize(1);
        ConstraintViolation<PaymentRequest> violation = violations.iterator().next();
        assertThat(violation.getPropertyPath().toString()).isEqualTo("currency");
        assertThat(violation.getMessage()).contains("RUB");
    }
}

