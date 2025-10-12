package com.crm.auth

import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.testcontainers.containers.GenericContainer
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.utility.DockerImageName

@Testcontainers(disabledWithoutDocker = true)
@ExtendWith(SpringExtension::class)
abstract class AbstractIntegrationTest {

    companion object {
        @Container
        private val postgres = PostgreSQLContainer(DockerImageName.parse("postgres:16-alpine"))
            .apply {
                withDatabaseName("auth")
                withUsername("auth")
                withPassword("auth")
            }

        @Container
        private val redis = GenericContainer(DockerImageName.parse("redis:7-alpine")).apply {
            withExposedPorts(6379)
        }

        @JvmStatic
        @DynamicPropertySource
        fun registerProperties(registry: DynamicPropertyRegistry) {
            registry.add("AUTH_DATABASE_URL") {
                "r2dbc:postgresql://${postgres.username}:${postgres.password}@${postgres.host}:${postgres.firstMappedPort}/${postgres.databaseName}"
            }
            registry.add("AUTH_REDIS_URL") { "redis://${redis.host}:${redis.firstMappedPort}/0" }
            registry.add("AUTH_JWT_SECRET") { "test-secret" }
            registry.add("AUTH_JWT_ISSUER") { "http://localhost" }
            registry.add("AUTH_JWT_AUDIENCE") { "crm-test" }
        }
    }
}
