package com.crm.payments.api;

import com.crm.payments.api.dto.PaymentListRequest;
import com.crm.payments.api.dto.PaymentRequest;
import com.crm.payments.api.dto.PaymentResponse;
import com.crm.payments.api.dto.PaymentStreamEvent;
import com.crm.payments.service.PaymentService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Validated
@RestController
@RequestMapping({"/api/v1", "/api"})
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/payments")
    public Flux<PaymentResponse> listPayments(@Valid PaymentListRequest request) {
        return paymentService.findAll(request);
    }

    @GetMapping("/payments/{paymentId}")
    public Mono<ResponseEntity<PaymentResponse>> getPayment(@PathVariable UUID paymentId) {
        return paymentService.findById(paymentId)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @PostMapping("/payments")
    public Mono<ResponseEntity<PaymentResponse>> createPayment(@Valid @RequestBody PaymentRequest request) {
        return paymentService.create(request)
                .map(response -> ResponseEntity.status(201).body(response));
    }

    @GetMapping(path = "/streams/payments", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<PaymentStreamEvent> streamPayments() {
        return paymentService.streamEvents();
    }
}
