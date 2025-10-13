package com.crm.payments.api;

import com.crm.payments.api.dto.CrmWebhookRequest;
import com.crm.payments.service.PaymentsWebhookService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@Validated
@RestController
@RequestMapping({"/api/v1/webhooks", "/api/webhooks"})
public class PaymentsWebhookController {

    private final PaymentsWebhookService paymentsWebhookService;

    public PaymentsWebhookController(PaymentsWebhookService paymentsWebhookService) {
        this.paymentsWebhookService = paymentsWebhookService;
    }

    @PostMapping("/crm")
    public Mono<ResponseEntity<Void>> handleWebhook(@Valid @RequestBody CrmWebhookRequest request) {
        return paymentsWebhookService.processWebhook(request)
                .thenReturn(ResponseEntity.accepted().build());
    }
}
