package com.crm.payments.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.crm.payments.api.dto.PaymentRequest;
import com.crm.payments.api.dto.PaymentResponse;
import com.crm.payments.api.dto.UpdatePaymentRequest;
import com.crm.payments.service.PaymentService;
import com.crm.payments.service.PaymentsWebhookService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

@WebFluxTest(PaymentsWebhookController.class)
@Import(PaymentsWebhookService.class)
@TestPropertySource(properties = {
        "payments.crm.webhook.secret=test-secret",
        "server.error.include-message=always"
})
class PaymentsWebhookControllerTest {

    private static final String SECRET = "test-secret";

    @Autowired
    private WebTestClient webTestClient;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PaymentService paymentService;

    @Test
    void shouldAcceptEventWithValidSignature() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("deal_id", "e1b8f44c-7c39-4e5c-8cb7-60c79c7c7bb5");
        payload.put("initiator_user_id", "d3c0f842-8794-4f0e-b52e-4f219d2ef0c0");
        payload.put("amount", 1500);
        payload.put("currency", "RUB");
        payload.put("payment_type", "INITIAL");

        String signature = sign("payment.created", payload);

        when(paymentService.create(any(PaymentRequest.class))).thenReturn(Mono.just(new PaymentResponse()));

        webTestClient.post()
                .uri("/api/v1/webhooks/crm")
                .bodyValue(buildRequest("payment.created", payload, signature))
                .exchange()
                .expectStatus().isAccepted();

        ArgumentCaptor<PaymentRequest> requestCaptor = ArgumentCaptor.forClass(PaymentRequest.class);
        verify(paymentService).create(requestCaptor.capture());
    }

    @Test
    void shouldPropagateConflictFromPaymentService() throws Exception {
        UUID paymentId = UUID.randomUUID();
        OffsetDateTime updatedAt = OffsetDateTime.now().minusMinutes(1).withNano(0);
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("paymentId", paymentId.toString());
        payload.put("updatedAt", updatedAt.toString());
        payload.put("amount", 1700);

        String signature = sign("payment.updated", payload);

        when(paymentService.update(eq(paymentId), any(UpdatePaymentRequest.class)))
                .thenReturn(Mono.error(new ResponseStatusException(HttpStatus.CONFLICT, "stale_update")));

        webTestClient.post()
                .uri("/api/v1/webhooks/crm")
                .bodyValue(buildRequest("payment.updated", payload, signature))
                .exchange()
                .expectStatus().isEqualTo(HttpStatus.CONFLICT);

        ArgumentCaptor<UpdatePaymentRequest> captor = ArgumentCaptor.forClass(UpdatePaymentRequest.class);
        verify(paymentService).update(eq(paymentId), captor.capture());
        assertThat(captor.getValue().getUpdatedAt()).isEqualTo(updatedAt);
    }

    @Test
    void shouldReturnNotFoundWhenPaymentMissing() throws Exception {
        UUID paymentId = UUID.randomUUID();
        OffsetDateTime updatedAt = OffsetDateTime.now().minusMinutes(2).withNano(0);
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("paymentId", paymentId.toString());
        payload.put("updatedAt", updatedAt.toString());

        String signature = sign("payment.updated", payload);

        when(paymentService.update(eq(paymentId), any(UpdatePaymentRequest.class))).thenReturn(Mono.empty());

        webTestClient.post()
                .uri("/api/v1/webhooks/crm")
                .bodyValue(buildRequest("payment.updated", payload, signature))
                .exchange()
                .expectStatus().isNotFound()
                .expectBody()
                .jsonPath("$.message").isEqualTo("payment_not_found");

        verify(paymentService).update(eq(paymentId), any(UpdatePaymentRequest.class));
    }

    @Test
    void shouldRejectEventWithInvalidSignature() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("deal_id", "e1b8f44c-7c39-4e5c-8cb7-60c79c7c7bb5");
        payload.put("initiator_user_id", "d3c0f842-8794-4f0e-b52e-4f219d2ef0c0");
        payload.put("amount", 1500);
        payload.put("currency", "RUB");
        payload.put("payment_type", "INITIAL");

        webTestClient.post()
                .uri("/api/v1/webhooks/crm")
                .bodyValue(buildRequest("payment.created", payload, "invalid"))
                .exchange()
                .expectStatus().isUnauthorized()
                .expectBody()
                .jsonPath("$.message").isEqualTo("invalid_signature");

        verify(paymentService, never()).create(any(PaymentRequest.class));
    }

    @Test
    void shouldReturnBadRequestWhenRequiredPaymentFieldsMissing() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("deal_id", "e1b8f44c-7c39-4e5c-8cb7-60c79c7c7bb5");
        // обязательные поля initiator_user_id, amount, currency и payment_type отсутствуют

        String signature = sign("payment.created", payload);

        webTestClient.post()
                .uri("/api/v1/webhooks/crm")
                .bodyValue(buildRequest("payment.created", payload, signature))
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.message").isEqualTo("invalid_payload");

        verify(paymentService, never()).create(any(PaymentRequest.class));
    }

    @Test
    void shouldReturnBadRequestWhenUpdatePayloadFailsValidation() throws Exception {
        UUID paymentId = UUID.randomUUID();
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("paymentId", paymentId.toString());
        payload.put("updatedAt", OffsetDateTime.now().toString());
        payload.put("currency", "USD");

        String signature = sign("payment.updated", payload);

        webTestClient.post()
                .uri("/api/v1/webhooks/crm")
                .bodyValue(buildRequest("payment.updated", payload, signature))
                .exchange()
                .expectStatus().isBadRequest()
                .expectBody()
                .jsonPath("$.message").isEqualTo("invalid_payload");

        verify(paymentService, never()).update(any(UUID.class), any(UpdatePaymentRequest.class));
    }

    private JsonNode buildRequest(String event, JsonNode payload, String signature) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("event", event);
        root.set("payload", payload);
        root.put("signature", signature);
        return root;
    }

    private String sign(String event, JsonNode payload) throws JsonProcessingException,
            NoSuchAlgorithmException, InvalidKeyException {
        String canonicalPayload = objectMapper.writeValueAsString(payload);
        String data = event + ":" + canonicalPayload;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] digest = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(digest);
    }
}
