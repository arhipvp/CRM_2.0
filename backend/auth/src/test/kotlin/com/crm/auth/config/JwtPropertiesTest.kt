package com.crm.auth.config

import java.time.Duration
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.context.annotation.Configuration

class JwtPropertiesTest {

    private val contextRunner = ApplicationContextRunner()
        .withUserConfiguration(TestConfiguration::class.java)
        .withPropertyValues(
            "auth.security.issuer=http://localhost",
            "auth.security.audience=crm-client",
            "auth.security.secret=test-secret",
            "auth.security.access-token-ttl-raw=PT20M"
        )

    @Test
    fun `should fallback to default refresh token ttl when property is empty`() {
        contextRunner.withPropertyValues("auth.security.refresh-token-ttl-raw=").run { context ->
            val properties = context.getBean(JwtProperties::class.java)

            assertThat(properties.refreshTokenTtl).isEqualTo(Duration.ofDays(7))
            assertThat(properties.accessTokenTtl).isEqualTo(Duration.parse("PT20M"))
        }
    }

    @Test
    fun `should parse refresh token ttl specified in calendar day format`() {
        contextRunner.withPropertyValues("auth.security.refresh-token-ttl-raw=P7D").run { context ->
            val properties = context.getBean(JwtProperties::class.java)

            assertThat(properties.refreshTokenTtl).isEqualTo(Duration.ofDays(7))
        }
    }

    @Test
    fun `should accept legacy refresh token ttl prefixed with time designator`() {
        contextRunner.withPropertyValues("auth.security.refresh-token-ttl-raw=PT7D").run { context ->
            val properties = context.getBean(JwtProperties::class.java)

            assertThat(properties.refreshTokenTtl).isEqualTo(Duration.ofDays(7))
        }
    }

    @Configuration
    @EnableConfigurationProperties(JwtProperties::class)
    private class TestConfiguration
}
