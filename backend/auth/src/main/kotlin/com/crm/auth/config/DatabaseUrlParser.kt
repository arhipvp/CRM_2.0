package com.crm.auth.config

import java.net.URI

object DatabaseUrlParser {
    data class DatabaseConnectionInfo(
        val jdbcUrl: String,
        val username: String?,
        val password: String?
    )

    fun parse(r2dbcUrl: String): DatabaseConnectionInfo {
        require(r2dbcUrl.isNotBlank()) { "AUTH_DATABASE_URL must be provided" }
        val withoutPrefix = r2dbcUrl.removePrefix("r2dbc:")
        val uri = URI(withoutPrefix)
        val userInfoParts = uri.userInfo?.split(":", limit = 2)
        val username = userInfoParts?.getOrNull(0)
        val password = userInfoParts?.getOrNull(1)
        val port = if (uri.port == -1) 5432 else uri.port
        val database = uri.path.trim('/',' ')
        val query = uri.query?.let { "?$it" } ?: ""
        val jdbcUrl = "jdbc:${uri.scheme}://${uri.host}:$port/$database$query"
        return DatabaseConnectionInfo(jdbcUrl, username, password)
    }
}
