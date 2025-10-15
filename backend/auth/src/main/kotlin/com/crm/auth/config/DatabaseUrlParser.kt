package com.crm.auth.config

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

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
        val userInfoParts = uri.rawUserInfo?.split(":", limit = 2)
        val username = userInfoParts?.getOrNull(0)?.let { decode(it) }
        val password = userInfoParts?.getOrNull(1)?.let { decode(it) }
        val port = if (uri.port == -1) 5432 else uri.port
        val database = uri.path.trim('/',' ')
        val query = uri.query?.let { "?$it" } ?: ""
        val jdbcUrl = "jdbc:${uri.scheme}://${uri.host}:$port/$database$query"
        return DatabaseConnectionInfo(jdbcUrl, username, password)
    }
    private fun decode(value: String): String = URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8)
}
