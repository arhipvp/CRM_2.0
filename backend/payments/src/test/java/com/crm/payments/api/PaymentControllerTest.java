package com.crm.payments.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.crm.payments.api.dto.PaymentRequest;
import com.crm.payments.api.dto.PaymentResponse;
import com.crm.payments.api.dto.PaymentStatusRequest;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.mockito.ArgumentCaptor;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

@WebFluxTest(PaymentController.class)
@TestPropertySource(properties = "server.error.include-message=always")
class PaymentControllerTest {

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private PaymentService paymentService;

    @Test
    void postPaymentShouldAcceptSnakeCasePayload() {
        UUID dealId = UUID.randomUUID();
        UUID policyId = UUID.randomUUID();
        UUID initiatorUserId = UUID.randomUUID();
        OffsetDateTime dueDate = OffsetDateTime.now().plusDays(5).withNano(0);

        PaymentResponse response = new PaymentResponse();
        response.setId(UUID.randomUUID());
        response.setDealId(dealId);
        response.setPolicyId(policyId);
        response.setInitiatorUserId(initiatorUserId);
        response.setAmount(BigDecimal.valueOf(2500));
        response.setCurrency("RUB");
        response.setStatus(PaymentStatus.PENDING);
        response.setPaymentType(PaymentType.INSTALLMENT);
        response.setDueDate(dueDate);

        when(paymentService.create(any(PaymentRequest.class))).thenReturn(Mono.just(response));

        webTestClient.post()
                .uri("/api/v1/payments")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{" +
                        "\"deal_id\": \"" + dealId + "\"," +
                        "\"policy_id\": \"" + policyId + "\"," +
                        "\"initiator_user_id\": \"" + initiatorUserId + "\"," +
                        "\"amount\": 2500," +
                        "\"currency\": \"RUB\"," +
                        "\"planned_date\": \"" + dueDate + "\"," +
                        "\"payment_type\": \"INSTALLMENT\"" +
                        "}")
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.dealId").isEqualTo(dealId.toString())
                .jsonPath("$.paymentType").isEqualTo(PaymentType.INSTALLMENT.name());

        ArgumentCaptor<PaymentRequest> requestCaptor = ArgumentCaptor.forClass(PaymentRequest.class);
        verify(paymentService).create(requestCaptor.capture());
        PaymentRequest capturedRequest = requestCaptor.getValue();

        assertThat(capturedRequest.getDealId()).isEqualTo(dealId);
        assertThat(capturedRequest.getPolicyId()).isEqualTo(policyId);
        assertThat(capturedRequest.getInitiatorUserId()).isEqualTo(initiatorUserId);
        assertThat(capturedRequest.getDueDate()).isEqualTo(dueDate);
        assertThat(capturedRequest.getPaymentType()).isEqualTo(PaymentType.INSTALLMENT);
    }

    @Test
    void patchPaymentShouldReturn200() {
        UUID paymentId = UUID.randomUUID();
        PaymentResponse response = new PaymentResponse();
        response.setId(paymentId);
        response.setAmount(BigDecimal.valueOf(123));
        response.setCurrency("RUB");
        response.setStatus(PaymentStatus.PENDING);
        response.setPaymentType(PaymentType.INSTALLMENT);
        response.setUpdatedAt(OffsetDateTime.now());

        when(paymentService.update(eq(paymentId), any(UpdatePaymentRequest.class))).thenReturn(Mono.just(response));

        webTestClient.patch()
                .uri("/api/v1/payments/{paymentId}", paymentId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{" +
                        "\"amount\": 123.0," +
                        "\"currency\": \"RUB\"" +
                        "}")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(paymentId.toString())
                .jsonPath("$.currency").isEqualTo("RUB");

        ArgumentCaptor<UpdatePaymentRequest> requestCaptor = ArgumentCaptor.forClass(UpdatePaymentRequest.class);
        verify(paymentService).update(eq(paymentId), requestCaptor.capture());
        assertThat(requestCaptor.getValue().getCurrency()).isEqualTo("RUB");
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

    @Test
    void patchPaymentShouldReturn400WhenCurrencyIsNotRub() {
        UUID paymentId = UUID.randomUUID();

        webTestClient.patch()
                .uri("/api/v1/payments/{paymentId}", paymentId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{" +
                        "\"currency\": \"USD\"" +
                        "}")
                .exchange()
                .expectStatus().isBadRequest();

        verify(paymentService, never()).update(any(UUID.class), any(UpdatePaymentRequest.class));
    }

    @Test
    void postPaymentStatusShouldReturn200() {
        UUID paymentId = UUID.randomUUID();
        PaymentResponse response = new PaymentResponse();
        response.setId(paymentId);
        response.setStatus(PaymentStatus.PROCESSING);
        response.setUpdatedAt(OffsetDateTime.now());

        when(paymentService.updateStatus(eq(paymentId), any(PaymentStatusRequest.class))).thenReturn(Mono.just(response));

        webTestClient.post()
                .uri("/api/v1/payments/{paymentId}/status", paymentId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{" +
                        "\"status\": \"PROCESSING\"," +
                        "\"comment\": \"Платёж в обработке\"" +
                        "}")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("PROCESSING");

        ArgumentCaptor<PaymentStatusRequest> captor = ArgumentCaptor.forClass(PaymentStatusRequest.class);
        verify(paymentService).updateStatus(eq(paymentId), captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(PaymentStatus.PROCESSING);
        assertThat(captor.getValue().getComment()).isEqualTo("Платёж в обработке");
    }

    @Test
    void postPaymentStatusShouldReturn404WhenPaymentMissing() {
        UUID paymentId = UUID.randomUUID();
        when(paymentService.updateStatus(eq(paymentId), any(PaymentStatusRequest.class))).thenReturn(Mono.empty());

        webTestClient.post()
                .uri("/api/v1/payments/{paymentId}/status", paymentId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{" +
                        "\"status\": \"PROCESSING\"" +
                        "}")
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void postPaymentStatusShouldReturn400WithInvalidTransitionReason() {
        UUID paymentId = UUID.randomUUID();
        when(paymentService.updateStatus(eq(paymentId), any(PaymentStatusRequest.class)))
                .thenReturn(Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_status_transition")));

        webTestClient.post()
                .uri("/api/v1/payments/{paymentId}/status", paymentId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{" +
                        "\"status\": \"PROCESSING\"" +
                        "}")
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.message").isEqualTo("invalid_status_transition");

        verify(paymentService).updateStatus(eq(paymentId), any(PaymentStatusRequest.class));
    }

    @Test
    void createPaymentShouldReturn400WhenCurrencyIsNotRub() {
        String dealId = UUID.randomUUID().toString();
        String initiatorId = UUID.randomUUID().toString();

        webTestClient.post()
                .uri("/api/v1/payments")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue("{" +
                        "\"dealId\": \"" + dealId + "\"," +
                        "\"initiatorUserId\": \"" + initiatorId + "\"," +
                        "\"amount\": 1000," +
                        "\"currency\": \"USD\"" +
                        "}")
                .exchange()
                .expectStatus().isBadRequest();

        verify(paymentService, never()).create(any());
    }
}
