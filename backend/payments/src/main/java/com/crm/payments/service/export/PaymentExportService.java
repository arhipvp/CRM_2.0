package com.crm.payments.service.export;

import com.crm.payments.api.dto.PaymentExportRequest;
import com.crm.payments.api.dto.PaymentExportResponse;
import com.crm.payments.config.PaymentExportProperties;
import com.crm.payments.domain.PaymentExportFormat;
import com.crm.payments.domain.PaymentExportJobEntity;
import com.crm.payments.domain.PaymentExportStatus;
import com.crm.payments.repository.PaymentExportJobRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Mono;

@Service
public class PaymentExportService {

    private static final Logger log = LoggerFactory.getLogger(PaymentExportService.class);

    private final PaymentExportJobRepository exportJobRepository;
    private final RabbitTemplate rabbitTemplate;
    private final PaymentExportProperties properties;
    private final ObjectMapper objectMapper;

    public PaymentExportService(PaymentExportJobRepository exportJobRepository,
            RabbitTemplate rabbitTemplate,
            PaymentExportProperties properties,
            ObjectMapper objectMapper) {
        this.exportJobRepository = exportJobRepository;
        this.rabbitTemplate = rabbitTemplate;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public Mono<PaymentExportResponse> requestExport(PaymentExportRequest request) {
        PaymentExportJobEntity entity = new PaymentExportJobEntity();
        entity.setId(UUID.randomUUID());
        entity.setStatus(PaymentExportStatus.PROCESSING);
        entity.setFormat(request.getFormat());
        entity.setFilters(serializeFilters(buildFilters(request)));
        entity.setCreatedAt(OffsetDateTime.now());
        entity.setUpdatedAt(entity.getCreatedAt());

        return exportJobRepository.save(entity)
                .flatMap(saved -> publishExportJob(saved)
                        .thenReturn(toResponse(saved)));
    }

    public Mono<PaymentExportResponse> getStatus(UUID jobId) {
        return exportJobRepository.findById(jobId)
                .map(this::toResponse);
    }

    @RabbitListener(queues = "#{paymentExportsStatusQueue.name}")
    public void handleStatusMessage(PaymentExportStatusMessage message) {
        if (message == null || message.getJobId() == null) {
            log.warn("Получено пустое сообщение статуса выгрузки: {}", message);
            return;
        }

        exportJobRepository.findById(message.getJobId())
                .flatMap(entity -> applyStatusUpdate(entity, message))
                .switchIfEmpty(Mono.fromRunnable(() ->
                        log.warn("Статус для неизвестной выгрузки {}", message.getJobId())))
                .onErrorResume(throwable -> {
                    log.error("Ошибка обработки статуса выгрузки {}", message.getJobId(), throwable);
                    return Mono.empty();
                })
                .block();
    }

    private Mono<PaymentExportJobEntity> applyStatusUpdate(PaymentExportJobEntity entity,
            PaymentExportStatusMessage message) {
        PaymentExportStatus status = message.getStatus();
        if (status != null) {
            entity.setStatus(status);
        }
        if (StringUtils.hasText(message.getDownloadUrl())) {
            entity.setDownloadUrl(message.getDownloadUrl());
        }
        if (StringUtils.hasText(message.getStoragePath())) {
            entity.setStoragePath(message.getStoragePath());
        }
        if (StringUtils.hasText(message.getError())) {
            entity.setError(message.getError());
        }
        entity.setUpdatedAt(OffsetDateTime.now());
        if (status == PaymentExportStatus.DONE || status == PaymentExportStatus.FAILED) {
            entity.setCompletedAt(message.getCompletedAt() != null ? message.getCompletedAt() : OffsetDateTime.now());
        }
        return exportJobRepository.save(entity);
    }

    private Mono<Void> publishExportJob(PaymentExportJobEntity entity) {
        PaymentExportJobMessage message = new PaymentExportJobMessage();
        message.setJobId(entity.getId());
        message.setRequestedAt(entity.getCreatedAt());
        message.setFormat(entity.getFormat());
        message.setFilters(deserializeFilters(entity.getFilters()));
        message.setStorage(new PaymentExportJobMessage.StorageParameters(
                properties.getStorage().getBucket(),
                properties.getStorage().getPrefix(),
                properties.getStorage().getBaseUrl(),
                properties.getStorage().getUrlTtl()));

        return Mono.fromRunnable(() -> rabbitTemplate.convertAndSend(properties.getQueue(), message));
    }

    private PaymentExportResponse toResponse(PaymentExportJobEntity entity) {
        return new PaymentExportResponse(entity.getId(), entity.getStatus(), entity.getDownloadUrl());
    }

    private Map<String, Object> buildFilters(PaymentExportRequest request) {
        Map<String, Object> filters = new LinkedHashMap<>();
        if (request.getDealId() != null) {
            filters.put("dealId", request.getDealId());
        }
        if (request.getPolicyId() != null) {
            filters.put("policyId", request.getPolicyId());
        }
        if (!CollectionUtils.isEmpty(request.getStatuses())) {
            filters.put("statuses", request.getStatuses());
        }
        if (!CollectionUtils.isEmpty(request.getTypes())) {
            filters.put("types", request.getTypes());
        }
        if (request.getFromDate() != null) {
            filters.put("fromDate", request.getFromDate());
        }
        if (request.getToDate() != null) {
            filters.put("toDate", request.getToDate());
        }
        if (request.getLimit() != null) {
            filters.put("limit", request.getLimit());
        }
        if (request.getOffset() != null) {
            filters.put("offset", request.getOffset());
        }
        filters.put("format", request.getFormat());
        return filters;
    }

    private String serializeFilters(Map<String, Object> filters) {
        try {
            return objectMapper.writeValueAsString(filters);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Не удалось сериализовать параметры экспорта", e);
        }
    }

    private Map<String, Object> deserializeFilters(String value) {
        if (!StringUtils.hasText(value)) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(value, objectMapper.getTypeFactory()
                    .constructMapType(Map.class, String.class, Object.class));
        } catch (JsonProcessingException e) {
            log.warn("Не удалось десериализовать фильтры выгрузки {}", value, e);
            return Map.of();
        }
    }

    public static class PaymentExportJobMessage {

        private UUID jobId;
        private OffsetDateTime requestedAt;
        private PaymentExportFormat format;
        private Map<String, Object> filters;
        private StorageParameters storage;

        public UUID getJobId() {
            return jobId;
        }

        public void setJobId(UUID jobId) {
            this.jobId = jobId;
        }

        public OffsetDateTime getRequestedAt() {
            return requestedAt;
        }

        public void setRequestedAt(OffsetDateTime requestedAt) {
            this.requestedAt = requestedAt;
        }

        public PaymentExportFormat getFormat() {
            return format;
        }

        public void setFormat(PaymentExportFormat format) {
            this.format = format;
        }

        public Map<String, Object> getFilters() {
            return filters;
        }

        public void setFilters(Map<String, Object> filters) {
            this.filters = filters;
        }

        public StorageParameters getStorage() {
            return storage;
        }

        public void setStorage(StorageParameters storage) {
            this.storage = storage;
        }

        public static class StorageParameters {

            private String bucket;
            private String prefix;
            private String baseUrl;
            private java.time.Duration urlTtl;

            public StorageParameters() {
            }

            public StorageParameters(String bucket, String prefix, String baseUrl, java.time.Duration urlTtl) {
                this.bucket = bucket;
                this.prefix = prefix;
                this.baseUrl = baseUrl;
                this.urlTtl = urlTtl;
            }

            public String getBucket() {
                return bucket;
            }

            public void setBucket(String bucket) {
                this.bucket = bucket;
            }

            public String getPrefix() {
                return prefix;
            }

            public void setPrefix(String prefix) {
                this.prefix = prefix;
            }

            public String getBaseUrl() {
                return baseUrl;
            }

            public void setBaseUrl(String baseUrl) {
                this.baseUrl = baseUrl;
            }

            public java.time.Duration getUrlTtl() {
                return urlTtl;
            }

            public void setUrlTtl(java.time.Duration urlTtl) {
                this.urlTtl = urlTtl;
            }
        }
    }

    public static class PaymentExportStatusMessage {

        private UUID jobId;
        private PaymentExportStatus status;
        private String downloadUrl;
        private String storagePath;
        private String error;
        private OffsetDateTime completedAt;

        public UUID getJobId() {
            return jobId;
        }

        public void setJobId(UUID jobId) {
            this.jobId = jobId;
        }

        public PaymentExportStatus getStatus() {
            return status;
        }

        public void setStatus(PaymentExportStatus status) {
            this.status = status;
        }

        public String getDownloadUrl() {
            return downloadUrl;
        }

        public void setDownloadUrl(String downloadUrl) {
            this.downloadUrl = downloadUrl;
        }

        public String getStoragePath() {
            return storagePath;
        }

        public void setStoragePath(String storagePath) {
            this.storagePath = storagePath;
        }

        public String getError() {
            return error;
        }

        public void setError(String error) {
            this.error = error;
        }

        public OffsetDateTime getCompletedAt() {
            return completedAt;
        }

        public void setCompletedAt(OffsetDateTime completedAt) {
            this.completedAt = completedAt;
        }
    }
}
