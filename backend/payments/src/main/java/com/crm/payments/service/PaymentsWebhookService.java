package com.crm.payments.service;

import com.crm.payments.api.dto.CrmWebhookRequest;
import com.crm.payments.api.dto.PaymentRequest;
import com.crm.payments.api.dto.UpdatePaymentRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import java.util.Set;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

@Service
public class PaymentsWebhookService {

    private static final Logger log = LoggerFactory.getLogger(PaymentsWebhookService.class);
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final PaymentService paymentService;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final SecretKeySpec secretKey;

    public PaymentsWebhookService(
            PaymentService paymentService,
            ObjectMapper objectMapper,
            Validator validator,
            @Value("${payments.crm.webhook.secret:}") String webhookSecret) {
        this.paymentService = paymentService;
        this.objectMapper = objectMapper;
        this.validator = validator;
        Assert.hasText(webhookSecret, "payments.crm.webhook.secret must be configured");
        this.secretKey = new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
    }

    public Mono<Void> processWebhook(CrmWebhookRequest request) {
        if (!isSignatureValid(request)) {
            log.warn("Получен webhook с некорректной подписью: событие {}", request.getEvent());
            return Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid signature"));
        }

        String event = request.getEvent();
        if (!StringUtils.hasText(event)) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event is required"));
        }

        return switch (event) {
            case "payment.created" -> handlePaymentCreated(request.getPayload());
            case "payment.updated" -> handlePaymentUpdated(request.getPayload());
            default -> Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unsupported event type: " + event));
        };
    }

    private Mono<Void> handlePaymentCreated(JsonNode payload) {
        try {
            PaymentRequest paymentRequest = objectMapper.treeToValue(payload, PaymentRequest.class);
            validatePaymentRequest(paymentRequest);
            return paymentService.create(paymentRequest).then();
        } catch (JsonProcessingException e) {
            log.warn("Не удалось десериализовать payload вебхука payment.created", e);
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payload"));
        } catch (ConstraintViolationException e) {
            log.warn("Payload вебхука payment.created не прошёл валидацию: {}", e.getMessage());
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_payload"));
        }
    }

    private void validatePaymentRequest(PaymentRequest paymentRequest) {
        Set<ConstraintViolation<PaymentRequest>> violations = validator.validate(paymentRequest);
        if (!violations.isEmpty()) {
            throw new ConstraintViolationException("Invalid payment request", violations);
        }
    }

    private Mono<Void> handlePaymentUpdated(JsonNode payload) {
        JsonNode paymentIdNode = payload.get("paymentId");
        if (paymentIdNode == null || !paymentIdNode.isTextual()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "payload.paymentId is required for payment.updated"));
        }

        UUID paymentId;
        try {
            paymentId = UUID.fromString(paymentIdNode.asText());
        } catch (IllegalArgumentException ex) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "payload.paymentId must be a valid UUID"));
        }

        try {
            ObjectReader reader = objectMapper.readerFor(UpdatePaymentRequest.class)
                    .without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
            UpdatePaymentRequest updateRequest = reader.readValue(payload);
            return paymentService.update(paymentId, updateRequest)
                    .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found")))
                    .then();
        } catch (IOException e) {
            log.warn("Не удалось десериализовать payload вебхука payment.updated", e);
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payload"));
        }
    }

    private boolean isSignatureValid(CrmWebhookRequest request) {
        if (request.getPayload() == null || !StringUtils.hasText(request.getSignature())
                || !StringUtils.hasText(request.getEvent())) {
            return false;
        }

        String canonicalPayload;
        try {
            canonicalPayload = objectMapper.writeValueAsString(request.getPayload());
        } catch (JsonProcessingException e) {
            log.warn("Не удалось сериализовать payload вебхука для подписи", e);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payload");
        }

        String dataToSign = request.getEvent() + ":" + canonicalPayload;
        String expectedSignature = computeSignature(dataToSign);
        byte[] expectedBytes = expectedSignature.getBytes(StandardCharsets.UTF_8);
        byte[] providedBytes = request.getSignature().getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expectedBytes, providedBytes);
    }

    private String computeSignature(String data) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(secretKey);
            byte[] digest = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("Cannot compute webhook signature", e);
        }
    }
}
