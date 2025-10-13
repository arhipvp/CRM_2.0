package com.crm.audit

import com.crm.audit.api.dto.AuditEventsPageResponse
import com.crm.audit.domain.AuditEventMessage
import com.crm.audit.domain.AuditEventRepository
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.function.Consumer
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.reactive.server.WebTestClient
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.containers.RabbitMQContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@ActiveProfiles("test")
class AuditEventsControllerIntegrationTest {

    companion object {
        @Container
        private val postgres = PostgreSQLContainer("postgres:16-alpine").apply {
            withDatabaseName("crm")
            withUsername("audit")
            withPassword("audit")
        }

        @Container
        private val rabbit = RabbitMQContainer("rabbitmq:3.13-management-alpine")

        @JvmStatic
        @DynamicPropertySource
        fun registerProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url") { postgres.jdbcUrl + "?currentSchema=audit" }
            registry.add("spring.datasource.username") { postgres.username }
            registry.add("spring.datasource.password") { postgres.password }
            registry.add("spring.r2dbc.url") {
                "r2dbc:postgresql://${postgres.host}:${postgres.firstMappedPort}/${postgres.databaseName}?currentSchema=audit"
            }
            registry.add("spring.r2dbc.username") { postgres.username }
            registry.add("spring.r2dbc.password") { postgres.password }
            registry.add("spring.cloud.stream.binders.rabbit.environment.spring.rabbitmq.host") { rabbit.host }
            registry.add("spring.cloud.stream.binders.rabbit.environment.spring.rabbitmq.port") { rabbit.amqpPort }
            registry.add("spring.cloud.stream.binders.rabbit.environment.spring.rabbitmq.username") { rabbit.adminUsername }
            registry.add("spring.cloud.stream.binders.rabbit.environment.spring.rabbitmq.password") { rabbit.adminPassword }
            registry.add("spring.cloud.stream.binders.rabbit.environment.spring.rabbitmq.virtual-host") { "/" }
            registry.add("spring.rabbitmq.host") { rabbit.host }
            registry.add("spring.rabbitmq.port") { rabbit.amqpPort }
            registry.add("spring.rabbitmq.username") { rabbit.adminUsername }
            registry.add("spring.rabbitmq.password") { rabbit.adminPassword }
        }
    }

    @Autowired
    private lateinit var auditEventConsumer: Consumer<AuditEventMessage>

    @Autowired
    private lateinit var auditEventRepository: AuditEventRepository

    @Autowired
    private lateinit var webTestClient: WebTestClient

    @BeforeEach
    fun cleanDatabase() = runBlocking {
        auditEventRepository.deleteAll()
    }

    @Test
    fun `should publish event and fetch it via REST`() {
        val occurredAt = Instant.parse("2024-11-24T12:34:56Z")
        val message = AuditEventMessage(
            eventId = "evt-rest-1",
            eventType = "crm.audit.tested",
            source = "integration-test",
            occurredAt = occurredAt,
            payload = null
        )

        auditEventConsumer.accept(message)

        val total = runBlocking { auditEventRepository.count() }
        assertEquals(1L, total)

        val response = webTestClient.get()
            .uri { builder ->
                builder
                    .path("/api/audit/events")
                    .queryParam("eventType", message.eventType)
                    .queryParam("occurredAfter", occurredAt.minusSeconds(60).atOffset(ZoneOffset.UTC))
                    .queryParam("occurredBefore", occurredAt.plusSeconds(60).atOffset(ZoneOffset.UTC))
                    .build()
            }
            .exchange()
            .expectStatus().isOk
            .expectBody(AuditEventsPageResponse::class.java)
            .returnResult()
            .responseBody

        assertNotNull(response)
        assertEquals(1, response.totalElements)
        val event = response.content.single()
        assertEquals(message.eventId, event.eventId)
        assertEquals(message.eventType, event.eventType)
        assertEquals(OffsetDateTime.ofInstant(occurredAt, ZoneOffset.UTC), event.occurredAt)
    }
}
