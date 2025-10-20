package com.crm.auth.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "auth.bootstrap")
data class AdminBootstrapProperties(
    val enabled: Boolean = false,
    val email: String? = null,
    val password: String? = null,
    val roles: List<String> = listOf("ROLE_ADMIN")
)
