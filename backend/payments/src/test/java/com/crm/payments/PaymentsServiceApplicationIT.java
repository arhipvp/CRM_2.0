package com.crm.payments;

import static org.assertj.core.api.Assertions.assertThat;

import com.crm.payments.config.PaymentsMessagingConfiguration;
import com.crm.payments.messaging.PaymentStreamHandlers;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
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
    }

    @Test
    void contextLoads(ApplicationContext context) {
        assertThat(context.containsBeanDefinition("paymentsEventsExchangeDeclarable")).isTrue();
        assertThat(context.getBean(PaymentsMessagingConfiguration.class)).isNotNull();
        assertThat(context.getBean(PaymentStreamHandlers.class)).isNotNull();
        assertThat(context.containsBean("paymentEventsConsumer")).isTrue();
    }
}
