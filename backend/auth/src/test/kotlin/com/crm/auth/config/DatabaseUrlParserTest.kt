package com.crm.auth.config

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class DatabaseUrlParserTest {

    @Test
    fun `should decode credentials from r2dbc url`() {
        val url = "r2dbc:postgresql://encoded%21user:pa%40ss%21word%2Bmore@localhost:15432/auth_db?sslmode=disable"

        val info = DatabaseUrlParser.parse(url)

        assertThat(info.username).isEqualTo("encoded!user")
        assertThat(info.password).isEqualTo("pa@ss!word+more")
        assertThat(info.jdbcUrl).isEqualTo("jdbc:postgresql://localhost:15432/auth_db?sslmode=disable")
        assertThat(info.schema).isNull()
    }

    @Test
    fun `should extract schema from query`() {
        val url = "r2dbc:postgresql://user:pass@localhost/auth_db?schema=auth"

        val info = DatabaseUrlParser.parse(url)

        assertThat(info.jdbcUrl).isEqualTo("jdbc:postgresql://localhost:5432/auth_db?currentSchema=auth")
        assertThat(info.schema).isEqualTo("auth")
    }

    @Test
    fun `should extract schema from search path`() {
        val url = "r2dbc:postgresql://user:pass@localhost/auth_db?search_path=auth,%20public"

        val info = DatabaseUrlParser.parse(url)

        assertThat(info.schema).isEqualTo("auth")
    }

    @Test
    fun `should keep currentSchema parameter`() {
        val url = "r2dbc:postgresql://user:pass@localhost/auth_db?currentSchema=auth&sslmode=disable"

        val info = DatabaseUrlParser.parse(url)

        assertThat(info.jdbcUrl)
            .isEqualTo("jdbc:postgresql://localhost:5432/auth_db?currentSchema=auth&sslmode=disable")
        assertThat(info.schema).isEqualTo("auth")
    }
}
