package com.crm.payments.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.crm.payments.api.dto.PaymentRequest;
import com.crm.payments.domain.PaymentEntity;
import com.crm.payments.domain.PaymentType;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PaymentMapperTest {

    private final PaymentMapper mapper = new PaymentMapper();

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
}
