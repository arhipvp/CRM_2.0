package com.crm.auth.config

import java.time.Duration
import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "auth.security")
data class JwtProperties(
    val issuer: String,
    val audience: String,
    val secret: String,
    private val accessTokenTtlRaw: String?,
    private val refreshTokenTtlRaw: String?
) {
    val accessTokenTtl: Duration = parseDuration(accessTokenTtlRaw, DEFAULT_ACCESS_TOKEN_TTL)
    val refreshTokenTtl: Duration = parseDuration(refreshTokenTtlRaw, DEFAULT_REFRESH_TOKEN_TTL)

    companion object {
        private const val DEFAULT_ACCESS_TOKEN_TTL = "PT15M"
        private const val DEFAULT_REFRESH_TOKEN_TTL = "PT7D"
        private val DAY_TOKEN_PATTERN = Regex("^PT(?=\\d+D$)")

        private fun parseDuration(rawValue: String?, defaultValue: String): Duration {
            val normalized = rawValue
                ?.trim()
                .takeUnless { it.isNullOrEmpty() }
                ?: defaultValue

            val sanitized = normalized.replace(DAY_TOKEN_PATTERN, "P")

            return try {
                Duration.parse(sanitized)
            } catch (ex: Exception) {
                throw IllegalArgumentException("Cannot parse duration value '$normalized'", ex)
            }
        }
    }
}
