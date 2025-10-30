package com.crm.auth.config

import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

object DatabaseUrlParser {
    data class DatabaseConnectionInfo(
        val jdbcUrl: String,
        val username: String?,
        val password: String?,
        val schema: String?
    )

    fun parse(r2dbcUrl: String): DatabaseConnectionInfo {
        require(r2dbcUrl.isNotBlank()) { "AUTH_DATABASE_URL must be provided" }
        val withoutPrefix = r2dbcUrl.removePrefix("r2dbc:")
        val uri = URI(withoutPrefix)
        val userInfoParts = uri.rawUserInfo?.split(":", limit = 2)
        val username = userInfoParts?.getOrNull(0)?.let { decode(it) }
        val password = userInfoParts?.getOrNull(1)?.let { decode(it) }
        val port = if (uri.port == -1) 5432 else uri.port
        val database = uri.path.trim('/', ' ')
        val (query, schema) = parseQuery(uri)
        val jdbcUrl = buildString {
            append("jdbc:")
            append(uri.scheme)
            append("://")
            append(uri.host)
            append(":$port/")
            append(database)
            if (query.isNotEmpty()) {
                append("?")
                append(query)
            }
        }
        return DatabaseConnectionInfo(jdbcUrl, username, password, schema)
    }
    private fun parseQuery(uri: URI): Pair<String, String?> {
        val rawQuery = uri.rawQuery ?: return "" to null
        if (rawQuery.isBlank()) {
            return "" to null
        }

        val params = rawQuery.split("&")
            .filter { it.isNotBlank() }
            .mapNotNull { parameter ->
                val parts = parameter.split("=", limit = 2)
                val rawKey = parts.getOrNull(0)?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
                val key = decode(rawKey)
                val value = parts.getOrNull(1)?.let { decode(it) }
                key to value
            }

        val schema = params.firstNotNullOfOrNull { (key, value) ->
            when (key.lowercase()) {
                "schema", "currentschema" -> value?.takeIf { it.isNotBlank() }
                "search_path" -> value
                    ?.split(",")
                    ?.map { it.trim().trim('"') }
                    ?.firstOrNull { it.isNotBlank() }
                else -> null
            }
        }

        val updatedParams = params.mapNotNull { (key, value) ->
            when (key.lowercase()) {
                "schema" -> value?.let { "currentSchema" to it }
                else -> key to value
            }
        }

        val query = updatedParams.joinToString("&") { (key, value) ->
            buildString {
                append(encode(key))
                if (value != null) {
                    append("=")
                    append(encode(value))
                }
            }
        }

        return query to schema
    }

    private fun decode(value: String): String = URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8)

    private fun encode(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8)
}
