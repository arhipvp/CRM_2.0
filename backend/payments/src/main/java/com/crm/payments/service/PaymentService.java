package com.crm.payments.service;

import com.crm.payments.api.dto.PaymentListRequest;
import com.crm.payments.api.dto.PaymentRequest;
import com.crm.payments.api.dto.PaymentResponse;
import com.crm.payments.api.dto.PaymentStreamEvent;
import com.crm.payments.api.dto.UpdatePaymentRequest;
import com.crm.payments.domain.PaymentEntity;
import com.crm.payments.domain.PaymentHistoryEntity;
import com.crm.payments.domain.PaymentStatus;
import com.crm.payments.messaging.dto.PaymentQueueEvent;
import com.crm.payments.repository.PaymentHistoryRepository;
import com.crm.payments.repository.PaymentRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.stream.function.StreamBridge;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    private static final String PAYMENT_EVENTS_OUTPUT = "paymentEvents-out-0";
    private static final String PAYMENT_CREATED_EVENT = "payment.created";
    private static final String PAYMENT_UPDATED_EVENT = "payment.updated";

    private final PaymentRepository paymentRepository;
    private final PaymentHistoryRepository paymentHistoryRepository;
    private final PaymentMapper paymentMapper;
    private final StreamBridge streamBridge;
    private final Sinks.Many<PaymentStreamEvent> streamSink;

    public PaymentService(
            PaymentRepository paymentRepository,
            PaymentHistoryRepository paymentHistoryRepository,
            PaymentMapper paymentMapper,
            StreamBridge streamBridge,
            Sinks.Many<PaymentStreamEvent> streamSink) {
        this.paymentRepository = paymentRepository;
        this.paymentHistoryRepository = paymentHistoryRepository;
        this.paymentMapper = paymentMapper;
        this.streamBridge = streamBridge;
        this.streamSink = streamSink;
    }

    public Flux<PaymentResponse> findAll(PaymentListRequest request) {
        return paymentRepository.findAll(request)
                .map(paymentMapper::toResponse);
    }

    public Mono<PaymentResponse> findById(UUID paymentId) {
        return paymentRepository.findById(paymentId)
                .map(paymentMapper::toResponse);
    }

    public Mono<PaymentResponse> create(PaymentRequest request) {
        PaymentEntity entity = paymentMapper.fromRequest(request);
        return paymentRepository.save(entity)
                .flatMap(saved -> recordHistory(saved, PAYMENT_CREATED_EVENT, saved.getAmount(), null)
                        .thenReturn(saved))
                .doOnNext(saved -> publishQueueEvent(PAYMENT_CREATED_EVENT, saved, saved.getAmount()))
                .map(paymentMapper::toResponse)
                .doOnNext(response -> emitStreamEvent(PAYMENT_CREATED_EVENT, response.getId(), response.getStatus(),
                        response.getAmount(), response.getDealId()))
                .doOnSuccess(response -> log.info("Создан платёж {} для сделки {}", response.getId(),
                        response.getDealId()));
    }

    public Mono<PaymentResponse> update(UUID paymentId, UpdatePaymentRequest request) {
        return paymentRepository.findById(paymentId)
                .flatMap(entity -> applyUpdates(entity, request))
                .map(paymentMapper::toResponse);
    }

    public Mono<Void> handleQueueEvent(PaymentQueueEvent event) {
        if (event == null || event.getPaymentId() == null) {
            log.warn("Получено пустое событие очереди payments.events: {}", event);
            return Mono.empty();
        }

        if (PAYMENT_CREATED_EVENT.equalsIgnoreCase(event.getEventType())) {
            log.debug("Пропускаем событие {} для платежа {} — создание зафиксировано локально", event.getEventType(),
                    event.getPaymentId());
            return Mono.empty();
        }

        return paymentRepository.findById(event.getPaymentId())
                .flatMap(entity -> applyEventToEntity(entity, event))
                .switchIfEmpty(Mono.defer(() -> {
                    log.warn("Событие {} относится к неизвестному платежу {}", event.getEventType(),
                            event.getPaymentId());
                    return Mono.empty();
                }))
                .then();
    }

    public Flux<PaymentStreamEvent> streamEvents() {
        return streamSink.asFlux();
    }

    private Mono<PaymentEntity> applyEventToEntity(PaymentEntity entity, PaymentQueueEvent event) {
        if (event.getStatus() != null) {
            entity.setStatus(event.getStatus());
        }
        if (event.getAmount() != null) {
            entity.setAmount(event.getAmount());
        }
        entity.setUpdatedAt(OffsetDateTime.now());
        if (event.getStatus() == PaymentStatus.COMPLETED) {
            entity.setProcessedAt(Optional.ofNullable(event.getOccurredAt()).orElseGet(OffsetDateTime::now));
        }

        return paymentRepository.save(entity)
                .flatMap(saved -> recordHistory(saved, event.getEventType(), event.getAmount(), null)
                        .thenReturn(saved))
                .doOnNext(saved -> emitStreamEvent(event.getEventType(), saved.getId(), saved.getStatus(),
                        saved.getAmount(), saved.getDealId()))
                .doOnNext(saved -> log.info("Обновлён платёж {} статус {}", saved.getId(), saved.getStatus()));
    }

    private Mono<PaymentEntity> applyUpdates(PaymentEntity entity, UpdatePaymentRequest request) {
        boolean changed = false;

        if (request.getAmount() != null && !amountEquals(entity.getAmount(), request.getAmount())) {
            entity.setAmount(request.getAmount());
            changed = true;
        }
        if (request.getCurrency() != null && !Objects.equals(entity.getCurrency(), request.getCurrency())) {
            entity.setCurrency(request.getCurrency());
            changed = true;
        }
        if (request.getDueDate() != null && !Objects.equals(entity.getDueDate(), request.getDueDate())) {
            entity.setDueDate(request.getDueDate());
            changed = true;
        }
        if (request.getProcessedAt() != null && !Objects.equals(entity.getProcessedAt(), request.getProcessedAt())) {
            entity.setProcessedAt(request.getProcessedAt());
            changed = true;
        }
        if (request.getPaymentType() != null && !Objects.equals(entity.getPaymentType(), request.getPaymentType())) {
            entity.setPaymentType(request.getPaymentType());
            changed = true;
        }
        if (request.getDescription() != null && !Objects.equals(entity.getDescription(), request.getDescription())) {
            entity.setDescription(request.getDescription());
            changed = true;
        }

        boolean shouldRecordHistory = changed || StringUtils.hasText(request.getComment());
        if (!shouldRecordHistory) {
            return Mono.just(entity);
        }

        entity.setUpdatedAt(OffsetDateTime.now());

        return paymentRepository.save(entity)
                .flatMap(saved -> recordHistory(saved, PAYMENT_UPDATED_EVENT, request.getAmount(), request.getComment())
                        .thenReturn(saved))
                .doOnNext(saved -> publishQueueEvent(PAYMENT_UPDATED_EVENT, saved, request.getAmount()))
                .doOnNext(saved -> emitStreamEvent(PAYMENT_UPDATED_EVENT, saved.getId(), saved.getStatus(),
                        saved.getAmount(), saved.getDealId()))
                .doOnNext(saved -> log.info("Обновлён платёж {} для сделки {}", saved.getId(), saved.getDealId()));
    }

    private boolean amountEquals(BigDecimal left, BigDecimal right) {
        if (left == null && right == null) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        return left.compareTo(right) == 0;
    }

    private Mono<PaymentHistoryEntity> recordHistory(PaymentEntity entity, String eventType, BigDecimal amount,
            String comment) {
        PaymentHistoryEntity history = new PaymentHistoryEntity();
        history.setPaymentId(entity.getId());
        history.setStatus(entity.getStatus());
        history.setAmount(amount != null ? amount : entity.getAmount());
        history.setChangedAt(OffsetDateTime.now());
        history.setDescription(StringUtils.hasText(comment) ? comment : eventType);
        return paymentHistoryRepository.save(history);
    }

    private void publishQueueEvent(String type, PaymentEntity entity, BigDecimal amount) {
        PaymentQueueEvent event = new PaymentQueueEvent();
        event.setEventType(type);
        event.setPaymentId(entity.getId());
        event.setDealId(entity.getDealId());
        event.setStatus(entity.getStatus());
        event.setAmount(amount != null ? amount : entity.getAmount());
        event.setOccurredAt(OffsetDateTime.now());
        boolean sent = streamBridge.send(PAYMENT_EVENTS_OUTPUT, event);
        if (!sent) {
            log.warn("Не удалось опубликовать событие {} в payments.events", type);
        }
    }

    private void emitStreamEvent(String type, UUID paymentId, PaymentStatus status,
            BigDecimal amount, UUID dealId) {
        PaymentStreamEvent event = new PaymentStreamEvent(type, paymentId, status, amount, OffsetDateTime.now(), dealId);
        Sinks.EmitResult result = streamSink.tryEmitNext(event);
        if (!Sinks.EmitResult.OK.equals(result)) {
            log.debug("Не удалось доставить событие SSE {} для платежа {}: {}", type, paymentId, result);
        }
    }
}
