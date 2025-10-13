package com.crm.payments.api;

import com.crm.payments.api.dto.PaymentExportRequest;
import com.crm.payments.api.dto.PaymentExportResponse;
import com.crm.payments.api.dto.PaymentListRequest;
import com.crm.payments.api.dto.PaymentRequest;
import com.crm.payments.api.dto.PaymentResponse;
import com.crm.payments.api.dto.PaymentStreamEvent;
import com.crm.payments.api.dto.PaymentStatusRequest;
import com.crm.payments.api.dto.UpdatePaymentRequest;
import com.crm.payments.service.PaymentService;
import com.crm.payments.service.export.PaymentExportService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Validated
@RestController
@RequestMapping({"/api/v1", "/api"})
public class PaymentController {

    private final PaymentService paymentService;
    private final PaymentExportService paymentExportService;

    public PaymentController(PaymentService paymentService, PaymentExportService paymentExportService) {
        this.paymentService = paymentService;
        this.paymentExportService = paymentExportService;
    }

    @GetMapping("/payments")
    public Flux<PaymentResponse> listPayments(@Valid PaymentListRequest request) {
        return paymentService.findAll(request);
    }

    @GetMapping("/payments/{paymentId}")
    public Mono<ResponseEntity<PaymentResponse>> getPayment(@PathVariable UUID paymentId) {
        return paymentService.findById(paymentId)
                .map(ResponseEntity::ok)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "payment_not_found")));
    }

    @PostMapping("/payments")
    public Mono<ResponseEntity<PaymentResponse>> createPayment(@Valid @RequestBody PaymentRequest request) {
        return paymentService.create(request)
                .map(response -> ResponseEntity.status(201).body(response));
    }

    @PatchMapping("/payments/{paymentId}")
    public Mono<ResponseEntity<PaymentResponse>> updatePayment(@PathVariable UUID paymentId,
            @Valid @RequestBody UpdatePaymentRequest request) {
        return paymentService.update(paymentId, request)
                .map(ResponseEntity::ok)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "payment_not_found")));
    }

    @PostMapping("/payments/{paymentId}/status")
    public Mono<ResponseEntity<PaymentResponse>> updatePaymentStatus(@PathVariable UUID paymentId,
            @Valid @RequestBody PaymentStatusRequest request) {
        return paymentService.updateStatus(paymentId, request)
                .map(ResponseEntity::ok)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "payment_not_found")));
    }

    @GetMapping(path = "/streams/payments", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<PaymentStreamEvent> streamPayments() {
        return paymentService.streamEvents();
    }

    @GetMapping("/payments/export")
    public Mono<ResponseEntity<PaymentExportResponse>> exportPayments(@Valid PaymentExportRequest request) {
        return paymentExportService.requestExport(request)
                .map(response -> ResponseEntity.accepted().body(response));
    }

    @GetMapping("/payments/export/{jobId}")
    public Mono<ResponseEntity<PaymentExportResponse>> getExportStatus(@PathVariable UUID jobId) {
        return paymentExportService.getStatus(jobId)
                .map(ResponseEntity::ok)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "export_not_found")));
    }
}
