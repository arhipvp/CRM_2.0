package com.crm.payments.service;

import com.crm.payments.api.dto.PaymentListRequest;
import com.crm.payments.api.dto.PaymentRequest;
import com.crm.payments.api.dto.PaymentResponse;
import com.crm.payments.api.dto.PaymentStreamEvent;
import com.crm.payments.api.dto.PaymentStatusRequest;
import com.crm.payments.api.dto.UpdatePaymentRequest;
import com.crm.payments.domain.PaymentEntity;
import com.crm.payments.domain.PaymentHistoryEntity;
import com.crm.payments.domain.PaymentStatus;
import com.crm.payments.messaging.dto.PaymentQueueEvent;
import com.crm.payments.repository.PaymentHistoryRepository;
import com.crm.payments.repository.PaymentRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.stream.function.StreamBridge;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    private static final String PAYMENT_EVENTS_OUTPUT = "paymentEvents-out-0";
    private static final String PAYMENT_CREATED_EVENT = "payment.created";
    private static final String PAYMENT_UPDATED_EVENT = "payment.updated";
    private static final String PAYMENT_STATUS_CHANGED_EVENT = "payment.status_changed";

    private static final Map<PaymentStatus, Set<PaymentStatus>> ALLOWED_TRANSITIONS = buildTransitions();

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
                .flatMapSequential(this::toResponseWithHistory);
    }

    public Mono<PaymentResponse> findById(UUID paymentId) {
        return paymentRepository.findById(paymentId)
                .flatMap(this::toResponseWithHistory);
    }

    public Mono<PaymentResponse> create(PaymentRequest request) {
        PaymentEntity entity = paymentMapper.fromRequest(request);
        return paymentRepository.save(entity)
                .flatMap(saved -> recordHistory(saved, PAYMENT_CREATED_EVENT, saved.getAmount(), null)
                        .thenReturn(saved))
                .doOnNext(saved -> publishQueueEvent(PAYMENT_CREATED_EVENT, saved, saved.getAmount()))
                .flatMap(this::toResponseWithHistory)
                .doOnNext(response -> emitStreamEvent(PAYMENT_CREATED_EVENT, response.getId(), response.getStatus(),
                        response.getAmount(), response.getDealId()))
                .doOnSuccess(response -> log.info("Создан платёж {} для сделки {}", response.getId(),
                        response.getDealId()));
    }

    public Mono<PaymentResponse> update(UUID paymentId, UpdatePaymentRequest request) {
        return paymentRepository.findById(paymentId)
                .flatMap(entity -> verifyVersionAndApplyUpdates(entity, request))
                .flatMap(this::toResponseWithHistory);
    }

    private Mono<PaymentEntity> verifyVersionAndApplyUpdates(PaymentEntity entity, UpdatePaymentRequest request) {
        OffsetDateTime requestVersion = request.getUpdatedAt();
        OffsetDateTime currentVersion = entity.getUpdatedAt();

        if (requestVersion != null && currentVersion != null && currentVersion.isAfter(requestVersion)) {
            return Mono.error(new ResponseStatusException(HttpStatus.CONFLICT, "stale_update"));
        }

        return applyUpdates(entity, request);
    }

    public Mono<PaymentResponse> updateStatus(UUID paymentId, PaymentStatusRequest request) {
        return paymentRepository.findById(paymentId)
                .flatMap(entity -> applyStatusUpdate(entity, request))
                .flatMap(this::toResponseWithHistory);
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
        if (event.getMetadata() != null) {
            Object actualDate = event.getMetadata().get("actualDate");
            if (actualDate instanceof OffsetDateTime actualDateTime) {
                entity.setProcessedAt(actualDateTime);
            }
            Object confirmation = event.getMetadata().get("confirmationReference");
            if (confirmation instanceof String reference && StringUtils.hasText(reference)) {
                entity.setConfirmationReference(reference);
            }
        }
        entity.setUpdatedAt(OffsetDateTime.now());
        if (event.getStatus() == PaymentStatus.COMPLETED && entity.getProcessedAt() == null) {
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
        if (request.getCurrency() != null) {
            if (!"RUB".equals(request.getCurrency())) {
                return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "validation_error"));
            }
            if (!Objects.equals(entity.getCurrency(), request.getCurrency())) {
                entity.setCurrency(request.getCurrency());
                changed = true;
            }
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

    private Mono<PaymentEntity> applyStatusUpdate(PaymentEntity entity, PaymentStatusRequest request) {
        PaymentStatus currentStatus = entity.getStatus();
        PaymentStatus targetStatus = request.getStatus();

        if (targetStatus == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "validation_error"));
        }

        if (currentStatus == targetStatus) {
            log.debug("Игнорируем обновление статуса {} для платежа {} — статус не изменился", targetStatus,
                    entity.getId());
            return Mono.just(entity);
        }

        if (!isTransitionAllowed(currentStatus, targetStatus)) {
            return Mono.error(new InvalidStatusTransitionException(currentStatus, targetStatus));
        }

        if (targetStatus == PaymentStatus.COMPLETED && request.getActualDate() == null) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "validation_error"));
        }

        if (targetStatus == PaymentStatus.CANCELLED && !StringUtils.hasText(request.getComment())) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "validation_error"));
        }

        entity.setStatus(targetStatus);
        if (request.getActualDate() != null) {
            entity.setProcessedAt(request.getActualDate());
        } else if (targetStatus == PaymentStatus.COMPLETED && entity.getProcessedAt() == null) {
            entity.setProcessedAt(OffsetDateTime.now());
        }

        if (StringUtils.hasText(request.getConfirmationReference())) {
            entity.setConfirmationReference(request.getConfirmationReference());
        }

        entity.setUpdatedAt(OffsetDateTime.now());

        Map<String, Object> finalMetadata = buildStatusMetadata(request);

        return paymentRepository.save(entity)
                .flatMap(saved -> recordHistory(saved, PAYMENT_STATUS_CHANGED_EVENT, saved.getAmount(), request.getComment())
                        .thenReturn(saved))
                .doOnNext(saved -> publishQueueEvent(PAYMENT_STATUS_CHANGED_EVENT, saved, null, finalMetadata))
                .doOnNext(saved -> emitStreamEvent(PAYMENT_STATUS_CHANGED_EVENT, saved.getId(), saved.getStatus(),
                        saved.getAmount(), saved.getDealId()))
                .doOnNext(saved -> log.info("Платёж {} переведён в статус {}", saved.getId(), saved.getStatus()));
    }

    private Map<String, Object> buildStatusMetadata(PaymentStatusRequest request) {
        Map<String, Object> metadata = new HashMap<>();
        if (request.getActualDate() != null) {
            metadata.put("actualDate", request.getActualDate());
        }
        if (StringUtils.hasText(request.getConfirmationReference())) {
            metadata.put("confirmationReference", request.getConfirmationReference());
        }
        if (StringUtils.hasText(request.getComment())) {
            metadata.put("comment", request.getComment());
        }
        return metadata.isEmpty() ? null : metadata;
    }

    private static Map<PaymentStatus, Set<PaymentStatus>> buildTransitions() {
        Map<PaymentStatus, Set<PaymentStatus>> transitions = new EnumMap<>(PaymentStatus.class);
        transitions.put(PaymentStatus.PENDING, EnumSet.of(PaymentStatus.PROCESSING, PaymentStatus.CANCELLED));
        transitions.put(PaymentStatus.PROCESSING,
                EnumSet.of(PaymentStatus.COMPLETED, PaymentStatus.FAILED, PaymentStatus.CANCELLED));
        transitions.put(PaymentStatus.FAILED, EnumSet.of(PaymentStatus.PROCESSING, PaymentStatus.CANCELLED));
        transitions.put(PaymentStatus.COMPLETED, EnumSet.of(PaymentStatus.CANCELLED));
        transitions.put(PaymentStatus.CANCELLED, EnumSet.noneOf(PaymentStatus.class));
        return transitions;
    }

    private boolean isTransitionAllowed(PaymentStatus currentStatus, PaymentStatus targetStatus) {
        return ALLOWED_TRANSITIONS.getOrDefault(currentStatus, EnumSet.noneOf(PaymentStatus.class))
                .contains(targetStatus);
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

    private Mono<PaymentResponse> toResponseWithHistory(PaymentEntity entity) {
        return paymentHistoryRepository.findAllByPaymentIdOrderByChangedAtAsc(entity.getId())
                .collectList()
                .map(history -> paymentMapper.toResponse(entity, history));
    }

    private void publishQueueEvent(String type, PaymentEntity entity, BigDecimal amount) {
        publishQueueEvent(type, entity, amount, null);
    }

    private void publishQueueEvent(String type, PaymentEntity entity, BigDecimal amount, Map<String, Object> metadata) {
        PaymentQueueEvent event = new PaymentQueueEvent();
        event.setEventType(type);
        event.setPaymentId(entity.getId());
        event.setDealId(entity.getDealId());
        event.setStatus(entity.getStatus());
        event.setAmount(amount != null ? amount : entity.getAmount());
        event.setOccurredAt(OffsetDateTime.now());
        if (metadata != null && !metadata.isEmpty()) {
            event.setMetadata(metadata);
        }
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
