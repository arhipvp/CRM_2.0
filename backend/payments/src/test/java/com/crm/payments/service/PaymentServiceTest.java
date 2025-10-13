package com.crm.payments.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.crm.payments.api.dto.PaymentStatusRequest;
import com.crm.payments.api.dto.PaymentStreamEvent;
import com.crm.payments.api.dto.UpdatePaymentRequest;
import com.crm.payments.domain.PaymentEntity;
import com.crm.payments.domain.PaymentHistoryEntity;
import com.crm.payments.domain.PaymentStatus;
import com.crm.payments.domain.PaymentType;
import com.crm.payments.messaging.dto.PaymentQueueEvent;
import com.crm.payments.repository.PaymentHistoryRepository;
import com.crm.payments.repository.PaymentRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cloud.stream.function.StreamBridge;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import reactor.test.StepVerifier;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private PaymentHistoryRepository paymentHistoryRepository;

    @Mock
    private StreamBridge streamBridge;

    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        lenient().when(streamBridge.send(anyString(), any())).thenReturn(true);
        PaymentMapper mapper = new PaymentMapper();
        Sinks.Many<PaymentStreamEvent> sink = Sinks.many().multicast().onBackpressureBuffer();
        paymentService = new PaymentService(paymentRepository, paymentHistoryRepository, mapper, streamBridge, sink);
    }

    @Test
    void updateShouldApplyChangesAndRecordHistory() {
        UUID paymentId = UUID.randomUUID();
        PaymentEntity entity = new PaymentEntity();
        entity.setId(paymentId);
        entity.setDealId(UUID.randomUUID());
        entity.setAmount(BigDecimal.valueOf(100));
        entity.setCurrency("RUB");
        entity.setStatus(PaymentStatus.PENDING);
        entity.setPaymentType(PaymentType.INITIAL);
        entity.setDueDate(OffsetDateTime.now().plusDays(1));
        entity.setDescription("Initial");
        entity.setCreatedAt(OffsetDateTime.now().minusDays(2));
        entity.setUpdatedAt(entity.getCreatedAt());

        when(paymentRepository.findById(paymentId)).thenReturn(Mono.just(entity));
        when(paymentRepository.save(any(PaymentEntity.class))).thenAnswer(invocation -> {
            PaymentEntity saved = invocation.getArgument(0);
            return Mono.just(saved);
        });
        when(paymentHistoryRepository.save(any(PaymentHistoryEntity.class)))
                .thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

        UpdatePaymentRequest request = new UpdatePaymentRequest();
        request.setAmount(BigDecimal.valueOf(150));
        request.setCurrency("RUB");
        request.setDueDate(OffsetDateTime.now().plusDays(5));
        request.setProcessedAt(OffsetDateTime.now());
        request.setPaymentType(PaymentType.COMMISSION);
        request.setDescription("Updated description");
        request.setComment("manual adjustment");

        StepVerifier.create(paymentService.update(paymentId, request))
                .assertNext(response -> {
                    assertThat(response.getAmount()).isEqualByComparingTo("150");
                    assertThat(response.getCurrency()).isEqualTo("RUB");
                    assertThat(response.getPaymentType()).isEqualTo(PaymentType.COMMISSION);
                    assertThat(response.getDescription()).isEqualTo("Updated description");
                    assertThat(response.getProcessedAt()).isEqualTo(request.getProcessedAt());
                    assertThat(response.getUpdatedAt()).isNotNull();
                })
                .verifyComplete();

        ArgumentCaptor<PaymentEntity> entityCaptor = ArgumentCaptor.forClass(PaymentEntity.class);
        verify(paymentRepository).save(entityCaptor.capture());
        PaymentEntity savedEntity = entityCaptor.getValue();
        assertThat(savedEntity.getAmount()).isEqualByComparingTo("150");
        assertThat(savedEntity.getCurrency()).isEqualTo("RUB");
        assertThat(savedEntity.getPaymentType()).isEqualTo(PaymentType.COMMISSION);
        assertThat(savedEntity.getDescription()).isEqualTo("Updated description");

        ArgumentCaptor<PaymentHistoryEntity> historyCaptor = ArgumentCaptor.forClass(PaymentHistoryEntity.class);
        verify(paymentHistoryRepository).save(historyCaptor.capture());
        PaymentHistoryEntity history = historyCaptor.getValue();
        assertThat(history.getAmount()).isEqualByComparingTo("150");
        assertThat(history.getDescription()).isEqualTo("manual adjustment");

        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(streamBridge).send(eq("paymentEvents-out-0"), eventCaptor.capture());
        assertThat(eventCaptor.getValue()).isInstanceOf(PaymentQueueEvent.class);
        PaymentQueueEvent queueEvent = (PaymentQueueEvent) eventCaptor.getValue();
        assertThat(queueEvent.getEventType()).isEqualTo("payment.updated");
        assertThat(queueEvent.getAmount()).isEqualByComparingTo("150");
    }

    @Test
    void updateShouldRejectCurrencyOtherThanRub() {
        UUID paymentId = UUID.randomUUID();
        PaymentEntity entity = new PaymentEntity();
        entity.setId(paymentId);
        entity.setCurrency("RUB");

        when(paymentRepository.findById(paymentId)).thenReturn(Mono.just(entity));

        UpdatePaymentRequest request = new UpdatePaymentRequest();
        request.setCurrency("USD");

        StepVerifier.create(paymentService.update(paymentId, request))
                .expectErrorSatisfies(throwable -> assertThat(throwable)
                        .isInstanceOf(IllegalArgumentException.class)
                        .hasMessage("Only RUB currency is supported"))
                .verify();

        verify(paymentRepository, never()).save(any(PaymentEntity.class));
        verify(paymentHistoryRepository, never()).save(any(PaymentHistoryEntity.class));
        verify(streamBridge, never()).send(anyString(), any());
    }

    @Test
    void updateShouldReturnEmptyWhenPaymentNotFound() {
        UUID paymentId = UUID.randomUUID();
        when(paymentRepository.findById(paymentId)).thenReturn(Mono.empty());

        StepVerifier.create(paymentService.update(paymentId, new UpdatePaymentRequest()))
                .verifyComplete();

        verify(paymentRepository, never()).save(any(PaymentEntity.class));
        verify(paymentHistoryRepository, never()).save(any(PaymentHistoryEntity.class));
        verify(streamBridge, never()).send(anyString(), any());
    }

    @Test
    void updateStatusShouldApplyTransitionAndPublishEvents() {
        UUID paymentId = UUID.randomUUID();
        PaymentEntity entity = new PaymentEntity();
        entity.setId(paymentId);
        entity.setDealId(UUID.randomUUID());
        entity.setAmount(BigDecimal.valueOf(500));
        entity.setCurrency("RUB");
        entity.setStatus(PaymentStatus.PROCESSING);
        entity.setPaymentType(PaymentType.INITIAL);
        entity.setCreatedAt(OffsetDateTime.now().minusDays(1));
        entity.setUpdatedAt(entity.getCreatedAt());

        when(paymentRepository.findById(paymentId)).thenReturn(Mono.just(entity));
        when(paymentRepository.save(any(PaymentEntity.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(paymentHistoryRepository.save(any(PaymentHistoryEntity.class)))
                .thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

        OffsetDateTime actualDate = OffsetDateTime.now().minusHours(2).withNano(0);
        PaymentStatusRequest request = new PaymentStatusRequest();
        request.setStatus(PaymentStatus.COMPLETED);
        request.setActualDate(actualDate);
        request.setConfirmationReference("REF-123");
        request.setComment("Подтверждено оператором");

        StepVerifier.create(paymentService.updateStatus(paymentId, request))
                .assertNext(response -> {
                    assertThat(response.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
                    assertThat(response.getProcessedAt()).isEqualTo(actualDate);
                    assertThat(response.getConfirmationReference()).isEqualTo("REF-123");
                })
                .verifyComplete();

        ArgumentCaptor<PaymentEntity> savedCaptor = ArgumentCaptor.forClass(PaymentEntity.class);
        verify(paymentRepository).save(savedCaptor.capture());
        PaymentEntity saved = savedCaptor.getValue();
        assertThat(saved.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(saved.getProcessedAt()).isEqualTo(actualDate);
        assertThat(saved.getConfirmationReference()).isEqualTo("REF-123");

        ArgumentCaptor<PaymentHistoryEntity> historyCaptor = ArgumentCaptor.forClass(PaymentHistoryEntity.class);
        verify(paymentHistoryRepository).save(historyCaptor.capture());
        assertThat(historyCaptor.getValue().getDescription()).isEqualTo("Подтверждено оператором");

        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);
        verify(streamBridge).send(eq("paymentEvents-out-0"), eventCaptor.capture());
        assertThat(eventCaptor.getValue()).isInstanceOf(PaymentQueueEvent.class);
        PaymentQueueEvent queueEvent = (PaymentQueueEvent) eventCaptor.getValue();
        assertThat(queueEvent.getEventType()).isEqualTo("payment.status_changed");
        assertThat(queueEvent.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(queueEvent.getMetadata()).isNotNull();
        assertThat(queueEvent.getMetadata()).containsEntry("actualDate", actualDate)
                .containsEntry("confirmationReference", "REF-123")
                .containsEntry("comment", "Подтверждено оператором");
    }

    @Test
    void updateStatusShouldRejectInvalidTransition() {
        UUID paymentId = UUID.randomUUID();
        PaymentEntity entity = new PaymentEntity();
        entity.setId(paymentId);
        entity.setStatus(PaymentStatus.CANCELLED);

        when(paymentRepository.findById(paymentId)).thenReturn(Mono.just(entity));

        PaymentStatusRequest request = new PaymentStatusRequest();
        request.setStatus(PaymentStatus.PROCESSING);

        StepVerifier.create(paymentService.updateStatus(paymentId, request))
                .expectErrorSatisfies(throwable -> assertThat(throwable)
                        .isInstanceOf(InvalidStatusTransitionException.class)
                        .hasMessageContaining("CANCELLED")
                        .hasMessageContaining("PROCESSING"))
                .verify();

        verify(paymentRepository, never()).save(any(PaymentEntity.class));
        verify(paymentHistoryRepository, never()).save(any(PaymentHistoryEntity.class));
        verify(streamBridge, never()).send(anyString(), any());
    }

    @Test
    void updateStatusShouldRequireCommentForCancelled() {
        UUID paymentId = UUID.randomUUID();
        PaymentEntity entity = new PaymentEntity();
        entity.setId(paymentId);
        entity.setStatus(PaymentStatus.PROCESSING);

        when(paymentRepository.findById(paymentId)).thenReturn(Mono.just(entity));

        PaymentStatusRequest request = new PaymentStatusRequest();
        request.setStatus(PaymentStatus.CANCELLED);

        StepVerifier.create(paymentService.updateStatus(paymentId, request))
                .expectErrorSatisfies(throwable -> assertThat(throwable)
                        .isInstanceOf(ResponseStatusException.class)
                        .hasMessageContaining("validation_error"))
                .verify();

        verify(paymentRepository, never()).save(any(PaymentEntity.class));
        verify(paymentHistoryRepository, never()).save(any(PaymentHistoryEntity.class));
        verify(streamBridge, never()).send(anyString(), any());
    }
}
