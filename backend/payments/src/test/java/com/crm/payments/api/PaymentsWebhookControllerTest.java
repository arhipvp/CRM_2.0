package com.crm.payments.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.crm.payments.api.dto.PaymentRequest;
import com.crm.payments.api.dto.PaymentResponse;
import com.crm.payments.service.PaymentService;
import com.crm.payments.service.PaymentsWebhookService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;

@WebFluxTest(PaymentsWebhookController.class)
@Import(PaymentsWebhookService.class)
@TestPropertySource(properties = "payments.crm.webhook.secret=test-secret")
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
                .expectStatus().isUnauthorized();

        verify(paymentService, never()).create(any(PaymentRequest.class));
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
