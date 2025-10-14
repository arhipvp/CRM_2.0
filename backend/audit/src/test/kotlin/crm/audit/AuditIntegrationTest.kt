package crm.audit

import com.fasterxml.jackson.databind.ObjectMapper
import crm.audit.config.AuditMessagingProperties
import crm.audit.domain.AuditEventRepository
import crm.audit.domain.AuditEventTagRepository
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.runBlocking
import org.awaitility.kotlin.await
import org.junit.jupiter.api.Test
import org.springframework.amqp.rabbit.core.RabbitTemplate
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
import org.testcontainers.utility.DockerImageName
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@AutoConfigureWebTestClient
@ActiveProfiles("test")
class AuditIntegrationTest @Autowired constructor(
    private val rabbitTemplate: RabbitTemplate,
    private val webTestClient: WebTestClient,
    private val objectMapper: ObjectMapper,
    private val messagingProperties: AuditMessagingProperties,
    private val auditEventRepository: AuditEventRepository,
    private val auditEventTagRepository: AuditEventTagRepository
) {

    @Test
    fun `should consume audit events and expose them via api`() {
        val occurredAt = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS)
        val eventId = "evt-${UUID.randomUUID()}"
        val payload = mapOf(
            "eventId" to eventId,
            "eventType" to "crm.deal.created",
            "eventSource" to "crm-service",
            "occurredAt" to occurredAt.toString(),
            "payload" to mapOf(
                "tags" to mapOf(
                    "dealId" to "DL-42",
                    "userId" to "USR-7"
                ),
                "data" to mapOf(
                    "field" to "value"
                )
            )
        )

        val json = objectMapper.writeValueAsString(payload)
        rabbitTemplate.sendToDestination(messagingProperties.eventsExchange, messagingProperties.eventsQueue, json)

        await.atMost(Duration.ofSeconds(10)).until {
            runBlocking { auditEventRepository.countEvents(null, null, null) } == 1L
        }

        // Отправляем дубликат в другую очередь, чтобы проверить идемпотентность
        rabbitTemplate.sendToDestination(messagingProperties.coreExchange, messagingProperties.coreQueue, json)

        await.atMost(Duration.ofSeconds(5)).until {
            runBlocking { auditEventRepository.countEvents(null, null, null) } == 1L
        }

        val saved = runBlocking {
            auditEventRepository.findByEventIdAndOccurredAt(eventId, occurredAt.atOffset(ZoneOffset.UTC))
        }
        requireNotNull(saved)

        val tags = runBlocking { auditEventTagRepository.findByEventId(saved.id) }
        assertEquals(2, tags.size)
        tags.forEach { tag ->
            assertEquals(saved.occurredAt, tag.eventOccurredAt)
        }

        webTestClient
            .get()
            .uri { builder ->
                builder
                    .path("/api/audit/events")
                    .queryParam("eventType", "crm.deal.created")
                    .queryParam("occurredAfter", occurredAt.minusSeconds(60).atOffset(ZoneOffset.UTC))
                    .queryParam("occurredBefore", occurredAt.plusSeconds(60).atOffset(ZoneOffset.UTC))
                    .build()
            }
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.totalElements").isEqualTo(1)
            .jsonPath("$.content[0].eventId").isEqualTo(eventId)
            .jsonPath("$.content[0].eventSource").isEqualTo("crm-service")
            .jsonPath("$.content[0].payload").value<String> { body ->
                assertTrue(body.contains("\"dealId\":\"DL-42\""))
            }
    }

    @Test
    fun `should write audit event into future monthly partition`() {
        val futureOccurredAt = Instant.now().plus(6, ChronoUnit.MONTHS).truncatedTo(ChronoUnit.MILLIS)
        val eventId = "evt-${UUID.randomUUID()}"
        val payload = mapOf(
            "eventId" to eventId,
            "eventType" to "crm.deal.status.changed",
            "eventSource" to "crm-service",
            "occurredAt" to futureOccurredAt.toString(),
            "payload" to mapOf(
                "data" to mapOf(
                    "status" to "approved"
                )
            )
        )

        rabbitTemplate.convertAndSend(messagingProperties.eventsQueue, objectMapper.writeValueAsString(payload))

        val expectedOccurredAt = futureOccurredAt.atOffset(ZoneOffset.UTC)

        await.atMost(Duration.ofSeconds(10)).until {
            runBlocking {
                auditEventRepository.findByEventIdAndOccurredAt(eventId, expectedOccurredAt)
            } != null
        }

        val saved = runBlocking {
            auditEventRepository.findByEventIdAndOccurredAt(eventId, expectedOccurredAt)
        }

        requireNotNull(saved)
        assertEquals(expectedOccurredAt, saved.occurredAt)
        assertEquals("crm.deal.status.changed", saved.eventType)
    private fun RabbitTemplate.sendToDestination(exchange: String?, routingKey: String, payload: Any) {
        if (exchange.isNullOrBlank()) {
            convertAndSend(routingKey, payload)
        } else {
            convertAndSend(exchange, routingKey, payload)
        }
    }

    companion object {
        @Suppress("DEPRECATION")
        @Container
        val postgres: PostgreSQLContainer<*> = PostgreSQLContainer(DockerImageName.parse("postgres:16-alpine"))
            .withDatabaseName("crm")
            .withUsername("audit")
            .withPassword("audit")

        @Suppress("DEPRECATION")
        @Container
        val rabbit: RabbitMQContainer = RabbitMQContainer(DockerImageName.parse("rabbitmq:3.13-management-alpine"))
            .withVhost("audit")
            .withUser("audit", "audit")
            .withPermission("audit", "audit", ".*", ".*", ".*")

        @JvmStatic
        @DynamicPropertySource
        fun registerProperties(registry: DynamicPropertyRegistry) {
            registry.add("AUDIT_DB_USER") { postgres.username }
            registry.add("AUDIT_DB_PASSWORD") { postgres.password }
            registry.add("AUDIT_DB_SCHEMA") { "audit" }
            registry.add("AUDIT_JDBC_URL") {
                val jdbcUrl = postgres.jdbcUrl
                val separator = if (jdbcUrl.contains("?")) "&" else "?"
                "${jdbcUrl}${separator}currentSchema=audit"
            }
            registry.add("AUDIT_R2DBC_URL") {
                "r2dbc:postgresql://${postgres.username}:${postgres.password}@${postgres.host}:${postgres.firstMappedPort}/${postgres.databaseName}?schema=audit"
            }
            registry.add("AUDIT_RABBITMQ_HOST") { rabbit.host }
            registry.add("AUDIT_RABBITMQ_PORT") { rabbit.amqpPort }
            registry.add("AUDIT_RABBITMQ_USER") { "audit" }
            registry.add("AUDIT_RABBITMQ_PASSWORD") { "audit" }
            registry.add("AUDIT_RABBITMQ_VHOST") { "audit" }
        }
    }
}
