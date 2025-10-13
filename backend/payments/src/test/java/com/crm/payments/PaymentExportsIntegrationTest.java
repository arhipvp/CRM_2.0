package com.crm.payments;

import com.crm.payments.api.dto.PaymentExportResponse;
import com.crm.payments.domain.PaymentExportStatus;
import com.crm.payments.repository.PaymentExportJobRepository;
import com.crm.payments.service.export.PaymentExportService.PaymentExportJobMessage;
import com.crm.payments.service.export.PaymentExportService.PaymentExportStatusMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.util.Assert;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers(disabledWithoutDocker = true)
class PaymentExportsIntegrationTest {

    private static final String EXPORT_QUEUE = "payments.exports.integration";
    private static final String STATUS_QUEUE = "payments.exports.integration.status";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("payments")
            .withUsername("payments")
            .withPassword("payments")
            .withInitScript("test-init.sql");

    @Container
    static final RabbitMQContainer RABBIT = new RabbitMQContainer("rabbitmq:3.12-management-alpine");

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.r2dbc.url", () -> String.format("r2dbc:postgresql://%s:%d/%s", POSTGRES.getHost(),
                POSTGRES.getMappedPort(PostgreSQLContainer.POSTGRESQL_PORT), POSTGRES.getDatabaseName()));
        registry.add("spring.r2dbc.username", POSTGRES::getUsername);
        registry.add("spring.r2dbc.password", POSTGRES::getPassword);
        registry.add("spring.flyway.url", () -> String.format("jdbc:postgresql://%s:%d/%s", POSTGRES.getHost(),
                POSTGRES.getMappedPort(PostgreSQLContainer.POSTGRESQL_PORT), POSTGRES.getDatabaseName()));
        registry.add("spring.flyway.user", POSTGRES::getUsername);
        registry.add("spring.flyway.password", POSTGRES::getPassword);
        registry.add("spring.rabbitmq.uri", RABBIT::getAmqpUrl);
        registry.add("payments.exports.queue", () -> EXPORT_QUEUE);
        registry.add("payments.exports.status-queue", () -> STATUS_QUEUE);
        registry.add("payments.exports.storage.bucket", () -> "payments-exports-test");
        registry.add("payments.exports.storage.prefix", () -> "payments/integration-tests");
        registry.add("payments.exports.storage.base-url", () -> "https://storage.test");
        registry.add("payments.exports.storage.url-ttl", () -> "PT6H");
    }

    @Autowired
    private WebTestClient webTestClient;

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PaymentExportJobRepository jobRepository;

    @Test
    void shouldCreateExportJobAndPublishMessage() throws Exception {
        PaymentExportResponse response = webTestClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/payments/export")
                        .queryParam("format", "csv")
                        .queryParam("dealId", UUID.randomUUID())
                        .queryParam("status", "PENDING")
                        .build())
                .exchange()
                .expectStatus().isAccepted()
                .expectBody(PaymentExportResponse.class)
                .returnResult()
                .getResponseBody();

        Assert.notNull(response, "Ответ не должен быть null");
        UUID jobId = response.getJobId();
        Assert.notNull(jobId, "jobId должен присутствовать");
        Assert.isTrue(response.getStatus() == PaymentExportStatus.PROCESSING,
                "Первичный статус должен быть processing");

        PaymentExportStatus jobStatus = jobRepository.findById(jobId)
                .map(entity -> entity.getStatus())
                .block(Duration.ofSeconds(5));
        Assert.isTrue(jobStatus == PaymentExportStatus.PROCESSING,
                "Статус в базе должен быть processing");

        Message message = rabbitTemplate.receive(EXPORT_QUEUE, 5_000);
        Assert.notNull(message, "Сообщение должно быть опубликовано в очередь экспорта");
        PaymentExportJobMessage jobMessage = objectMapper.readValue(message.getBody(), PaymentExportJobMessage.class);
        Assert.isTrue(jobId.equals(jobMessage.getJobId()), "В сообщении должен быть передан корректный jobId");
        Assert.isTrue("csv".equalsIgnoreCase(jobMessage.getFormat().getValue()), "Формат должен совпадать");
        Assert.isTrue(jobMessage.getFilters().containsKey("dealId"), "Фильтры должны включать dealId");
        Assert.isTrue(jobMessage.getStorage() != null, "Параметры хранения должны присутствовать");
    }

    @Test
    void shouldUpdateStatusFromQueueAndReturnDownloadUrl() {
        PaymentExportResponse response = webTestClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/payments/export")
                        .queryParam("format", "xlsx")
                        .build())
                .exchange()
                .expectStatus().isAccepted()
                .expectBody(PaymentExportResponse.class)
                .returnResult()
                .getResponseBody();

        Assert.notNull(response, "Ответ не должен быть null");
        UUID jobId = response.getJobId();
        Assert.notNull(jobId, "jobId должен присутствовать");

        drainQueue(EXPORT_QUEUE);

        PaymentExportStatusMessage statusMessage = new PaymentExportStatusMessage();
        statusMessage.setJobId(jobId);
        statusMessage.setStatus(PaymentExportStatus.DONE);
        statusMessage.setDownloadUrl("https://storage.test/payments/export-" + jobId + ".xlsx");
        statusMessage.setStoragePath("payments/integration-tests/export-" + jobId + ".xlsx");
        statusMessage.setCompletedAt(OffsetDateTime.now());

        rabbitTemplate.convertAndSend(STATUS_QUEUE, statusMessage);

        PaymentExportStatus updatedStatus = waitForStatus(jobId, PaymentExportStatus.DONE);
        Assert.isTrue(updatedStatus == PaymentExportStatus.DONE, "Статус должен обновиться на DONE");

        PaymentExportResponse statusResponse = webTestClient.get()
                .uri("/api/v1/payments/export/{jobId}", jobId)
                .exchange()
                .expectStatus().isOk()
                .expectBody(PaymentExportResponse.class)
                .returnResult()
                .getResponseBody();

        Assert.notNull(statusResponse, "Ответ не должен быть null");
        Assert.isTrue(PaymentExportStatus.DONE == statusResponse.getStatus(), "Статус должен быть DONE");
        Assert.isTrue(String.valueOf(statusResponse.getDownloadUrl()).contains(jobId.toString()),
                "В ссылке должен содержаться идентификатор выгрузки");
    }

    private void drainQueue(String queueName) {
        Message message;
        do {
            message = rabbitTemplate.receive(queueName, 500);
        } while (message != null);
    }

    private PaymentExportStatus waitForStatus(UUID jobId, PaymentExportStatus expected) {
        long timeoutMs = Duration.ofSeconds(5).toMillis();
        long pollIntervalMs = 200;
        long waited = 0;
        while (waited <= timeoutMs) {
            PaymentExportStatus status = jobRepository.findById(jobId)
                    .map(entity -> entity.getStatus())
                    .block(Duration.ofSeconds(1));
            if (expected.equals(status)) {
                return status;
            }
            try {
                Thread.sleep(pollIntervalMs);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                break;
            }
            waited += pollIntervalMs;
        }
        return jobRepository.findById(jobId)
                .map(entity -> entity.getStatus())
                .block(Duration.ofSeconds(1));
    }
}
