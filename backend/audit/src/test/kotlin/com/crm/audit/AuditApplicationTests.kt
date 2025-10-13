package com.crm.audit

import com.crm.audit.domain.AuditEventMessage
import com.crm.audit.domain.AuditEventRepository
import com.crm.audit.domain.AuditEventTagRepository
import com.crm.audit.stream.AuditEventProcessor
import java.time.Instant
import java.time.ZoneOffset
import java.util.function.Consumer
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.timeout
import org.mockito.kotlin.verify
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.mock.mockito.SpyBean
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.containers.RabbitMQContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest
@ActiveProfiles("test")
class AuditApplicationTests {

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
    private lateinit var auditEventTagRepository: AuditEventTagRepository

    @SpyBean
    private lateinit var processor: AuditEventProcessor

    private val objectMapper = jacksonObjectMapper()

    @BeforeEach
    fun cleanDatabase() = runBlocking {
        auditEventRepository.deleteAll()
    }

    @Test
    fun `should forward incoming events to processor`() {
        val payload = AuditEventMessage(
            eventId = "123",
            eventType = "crm.deal.created",
            source = "crm-service",
            occurredAt = Instant.now(),
            payload = null
        )

        auditEventConsumer.accept(payload)

        val eventCaptor = argumentCaptor<AuditEventMessage>()
        verify(processor, timeout(5000)).process(eventCaptor.capture())
        LoggerFactory.getLogger(AuditApplicationTests::class.java)
            .info("Получено событие {} в тесте", eventCaptor.firstValue.eventType)
    }

    @Test
    fun `should persist event when message received`() = runBlocking {
        val payload = AuditEventMessage(
            eventId = "evt-001",
            eventType = "crm.deal.created",
            source = "crm-service",
            occurredAt = Instant.parse("2024-11-21T10:15:30Z"),
            payload = null
        )

        auditEventConsumer.accept(payload)

        val saved = auditEventRepository.findByEventId("evt-001")
        assertNotNull(saved)
        assertEquals("crm.deal.created", saved.eventType)
        assertEquals("crm-service", saved.eventSource)
        assertEquals(payload.occurredAt.atOffset(ZoneOffset.UTC), saved.occurredAt)
    }

    @Test
    fun `should ignore duplicate events by id`() = runBlocking {
        val payload = AuditEventMessage(
            eventId = "evt-duplicate",
            eventType = "crm.user.updated",
            source = "crm-service",
            occurredAt = Instant.parse("2024-11-22T10:15:30Z"),
            payload = null
        )

        auditEventConsumer.accept(payload)
        auditEventConsumer.accept(payload)

        val count = auditEventRepository.count()
        assertEquals(1L, count)
    }

    @Test
    fun `should deduplicate by type time and source when id is absent`() = runBlocking {
        val payload = AuditEventMessage(
            eventId = null,
            eventType = "crm.user.login",
            source = "auth-service",
            occurredAt = Instant.parse("2024-11-22T12:00:00Z"),
            payload = null
        )

        auditEventConsumer.accept(payload)
        auditEventConsumer.accept(payload)

        val saved = auditEventRepository.findByEventTypeAndOccurredAtAndEventSource(
            payload.eventType,
            payload.occurredAt.atOffset(ZoneOffset.UTC),
            payload.source
        )
        assertNotNull(saved)
        assertEquals(payload.eventType, saved.eventType)
        assertEquals(payload.source, saved.eventSource)
        assertEquals(1L, auditEventRepository.count())
    }

    @Test
    fun `should deduplicate by type and time when source is absent`() = runBlocking {
        val payload = AuditEventMessage(
            eventId = null,
            eventType = "crm.user.logout",
            source = null,
            occurredAt = Instant.parse("2024-11-23T15:30:00Z"),
            payload = null
        )

        auditEventConsumer.accept(payload)
        auditEventConsumer.accept(payload)

        val saved = auditEventRepository.findByEventTypeAndOccurredAtAndEventSource(
            payload.eventType,
            payload.occurredAt.atOffset(ZoneOffset.UTC),
            payload.source
        )
        assertNotNull(saved)
        assertEquals(payload.eventType, saved.eventType)
        assertEquals(payload.source, saved.eventSource)
        assertEquals(1L, auditEventRepository.count())
    }

    @Test
    fun `should persist tags when payload contains tag object`() = runBlocking {
        val payloadJson = objectMapper.createObjectNode().apply {
            put("entityId", "deal-777")
            set<com.fasterxml.jackson.databind.node.ObjectNode>(
                "tags",
                objectMapper.createObjectNode().apply {
                    put("region", "msk")
                    put("priority", "high")
                    put("retry_count", 2)
                }
            )
        }

        val payload = AuditEventMessage(
            eventId = "evt-with-tags",
            eventType = "crm.deal.changed",
            source = "crm-service",
            occurredAt = Instant.parse("2024-11-24T10:00:00Z"),
            payload = payloadJson
        )

        auditEventConsumer.accept(payload)

        val saved = auditEventRepository.findByEventId("evt-with-tags")
        assertNotNull(saved)

        val tags = auditEventTagRepository.findByEventId(saved.id)
        assertEquals(3, tags.size)
        val tagsByKey = tags.associate { it.tagKey to it.tagValue }
        assertEquals("msk", tagsByKey["region"])
        assertEquals("high", tagsByKey["priority"])
        assertEquals("2", tagsByKey["retry_count"])
    }
}
