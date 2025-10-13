package com.crm.payments;

import static org.assertj.core.api.Assertions.assertThat;

import com.crm.payments.api.dto.PaymentResponse;
import com.crm.payments.config.PaymentsMessagingConfiguration;
import com.crm.payments.domain.PaymentEntity;
import com.crm.payments.domain.PaymentStatus;
import com.crm.payments.domain.PaymentType;
import com.crm.payments.messaging.PaymentStreamHandlers;
import com.crm.payments.repository.PaymentRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import reactor.core.publisher.Mono;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("test")
class PaymentsServiceApplicationIT {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
        .withDatabaseName("crm")
        .withUsername("payments")
        .withPassword("payments")
        .withInitScript("sql/create_payments_schema.sql");

    @Container
    static final RabbitMQContainer rabbit = new RabbitMQContainer("rabbitmq:3.13-management-alpine");

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.r2dbc.url", () -> String.format(
            "r2dbc:postgresql://%s:%d/%s?schema=payments",
            postgres.getHost(),
            postgres.getMappedPort(PostgreSQLContainer.POSTGRESQL_PORT),
            postgres.getDatabaseName()
        ));
        registry.add("spring.r2dbc.username", postgres::getUsername);
        registry.add("spring.r2dbc.password", postgres::getPassword);

        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", postgres::getUsername);
        registry.add("spring.flyway.password", postgres::getPassword);

        registry.add("spring.rabbitmq.addresses", rabbit::getAmqpUrl);
        registry.add(
            "spring.cloud.stream.binders.rabbit.environment.spring.rabbitmq.addresses",
            rabbit::getAmqpUrl
        );
        registry.add("payments.crm.webhook.secret", () -> "test-secret");
    }

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private DatabaseClient databaseClient;

    @Autowired
    private WebTestClient webTestClient;

    @Test
    void contextLoads(ApplicationContext context) {
        assertThat(context.containsBeanDefinition("paymentsEventsExchangeDeclarable")).isTrue();
        assertThat(context.getBean(PaymentsMessagingConfiguration.class)).isNotNull();
        assertThat(context.getBean(PaymentStreamHandlers.class)).isNotNull();
        assertThat(context.containsBean("paymentEventsConsumer")).isTrue();
    }

    @Test
    void listPaymentsAppliesFiltersAndPagination() {
        UUID dealId = UUID.randomUUID();
        UUID anotherDealId = UUID.randomUUID();
        UUID policyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        createReferenceData(dealId, anotherDealId, policyId, userId).block();

        PaymentEntity first = buildPayment(dealId, policyId, userId, PaymentStatus.COMPLETED,
                PaymentType.INITIAL, OffsetDateTime.now().minusHours(2));
        PaymentEntity second = buildPayment(dealId, policyId, userId, PaymentStatus.FAILED,
                PaymentType.REFUND, OffsetDateTime.now().minusHours(1));
        PaymentEntity third = buildPayment(anotherDealId, null, userId, PaymentStatus.PENDING,
                PaymentType.COMMISSION, OffsetDateTime.now().minusHours(3));

        paymentRepository.deleteAll().thenMany(paymentRepository.saveAll(List.of(first, second, third))).blockLast();

        OffsetDateTime from = OffsetDateTime.now().minusDays(1);
        OffsetDateTime to = OffsetDateTime.now().plusDays(1);

        List<PaymentResponse> firstPage = webTestClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/payments")
                        .queryParam("dealId", dealId)
                        .queryParam("status", PaymentStatus.COMPLETED)
                        .queryParam("status", PaymentStatus.FAILED)
                        .queryParam("type", PaymentType.REFUND)
                        .queryParam("fromDate", from)
                        .queryParam("toDate", to)
                        .queryParam("limit", 1)
                        .build())
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(PaymentResponse.class)
                .returnResult()
                .getResponseBody();

        assertThat(firstPage).isNotNull().hasSize(1);
        assertThat(firstPage.get(0).getId()).isEqualTo(second.getId());

        List<PaymentResponse> secondPage = webTestClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/payments")
                        .queryParam("dealId", dealId)
                        .queryParam("status", PaymentStatus.COMPLETED)
                        .queryParam("status", PaymentStatus.FAILED)
                        .queryParam("fromDate", from)
                        .queryParam("toDate", to)
                        .queryParam("limit", 1)
                        .queryParam("offset", 1)
                        .build())
                .exchange()
                .expectStatus().isOk()
                .expectBodyList(PaymentResponse.class)
                .returnResult()
                .getResponseBody();

        assertThat(secondPage).isNotNull().hasSize(1);
        assertThat(secondPage.get(0).getId()).isEqualTo(first.getId());
    }

    private Mono<Void> createReferenceData(UUID dealId, UUID anotherDealId, UUID policyId, UUID userId) {
        return databaseClient.sql("INSERT INTO crm.deals (id) VALUES ($1) ON CONFLICT (id) DO NOTHING")
                        .bind(0, dealId)
                        .fetch()
                        .rowsUpdated()
                .then(databaseClient.sql("INSERT INTO crm.deals (id) VALUES ($1) ON CONFLICT (id) DO NOTHING")
                        .bind(0, anotherDealId)
                        .fetch()
                        .rowsUpdated())
                .then(databaseClient.sql("INSERT INTO crm.policies (id, deal_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING")
                        .bind(0, policyId)
                        .bind(1, dealId)
                        .fetch()
                        .rowsUpdated())
                .then(databaseClient.sql("INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING")
                        .bind(0, userId)
                        .fetch()
                        .rowsUpdated())
                .then();
    }

    private PaymentEntity buildPayment(UUID dealId, UUID policyId, UUID initiatorId,
            PaymentStatus status, PaymentType type, OffsetDateTime createdAt) {
        PaymentEntity entity = new PaymentEntity();
        entity.setId(UUID.randomUUID());
        entity.setDealId(dealId);
        entity.setPolicyId(policyId);
        entity.setInitiatorUserId(initiatorId);
        entity.setAmount(new BigDecimal("100.00"));
        entity.setCurrency("RUB");
        entity.setStatus(status);
        entity.setPaymentType(type);
        entity.setDueDate(createdAt.plusDays(1));
        entity.setDescription("test");
        entity.setCreatedAt(createdAt);
        entity.setUpdatedAt(createdAt);
        return entity;
    }
}
