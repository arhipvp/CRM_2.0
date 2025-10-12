package com.crm.auth.config

import java.time.Duration
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.bind.DefaultValue

@ConfigurationProperties(prefix = "auth.security")
data class JwtProperties(
    val issuer: String,
    val audience: String,
    val secret: String,
    val accessTokenTtl: Duration,
    @DefaultValue("PT7D")
    val refreshTokenTtl: Duration
)
