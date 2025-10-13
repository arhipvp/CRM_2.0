package com.crm.payments.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.crm.payments.api.dto.PaymentResponse;
import com.crm.payments.api.dto.UpdatePaymentRequest;
import com.crm.payments.domain.PaymentStatus;
import com.crm.payments.domain.PaymentType;
import com.crm.payments.service.PaymentService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

@WebFluxTest(PaymentController.class)
class PaymentControllerTest {

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private PaymentService paymentService;

    @Test
    void patchPaymentShouldReturn200() {
        UUID paymentId = UUID.randomUUID();
        PaymentResponse response = new PaymentResponse();
        response.setId(paymentId);
        response.setAmount(BigDecimal.valueOf(123));
        response.setCurrency("USD");
        response.setStatus(PaymentStatus.PENDING);
        response.setPaymentType(PaymentType.INSTALLMENT);
        response.setUpdatedAt(OffsetDateTime.now());

        when(paymentService.update(eq(paymentId), any(UpdatePaymentRequest.class))).thenReturn(Mono.just(response));

        webTestClient.patch()
                .uri("/api/v1/payments/{paymentId}", paymentId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{" +
                        "\"amount\": 123.0," +
                        "\"currency\": \"USD\"" +
                        "}")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(paymentId.toString())
                .jsonPath("$.currency").isEqualTo("USD");
    }

    @Test
    void patchPaymentShouldReturn404WhenNotFound() {
        UUID paymentId = UUID.randomUUID();
        when(paymentService.update(eq(paymentId), any(UpdatePaymentRequest.class))).thenReturn(Mono.empty());

        webTestClient.patch()
                .uri("/api/v1/payments/{paymentId}", paymentId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{}")
                .exchange()
                .expectStatus().isNotFound();
    }
}
