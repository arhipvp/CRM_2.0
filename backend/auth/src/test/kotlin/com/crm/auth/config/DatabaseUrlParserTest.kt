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
    }
}
