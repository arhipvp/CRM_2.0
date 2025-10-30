package com.crm.auth.config

import com.zaxxer.hikari.HikariDataSource
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.jdbc.DataSourceBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.util.StringUtils
import liquibase.integration.spring.SpringLiquibase

@Configuration
class LiquibaseConfig(
    @Value("\${AUTH_DATABASE_URL:}") private val databaseUrl: String
) {
    @Bean
    fun liquibase(): SpringLiquibase {
        val info = DatabaseUrlParser.parse(databaseUrl)
        val dataSource = DataSourceBuilder.create()
            .type(HikariDataSource::class.java)
            .driverClassName("org.postgresql.Driver")
            .url(info.jdbcUrl)
            .apply {
                if (StringUtils.hasText(info.username)) {
                    username(info.username)
                }
                if (StringUtils.hasText(info.password)) {
                    password(info.password)
                }
            }
            .build()
        return SpringLiquibase().apply {
            this.dataSource = dataSource
            changeLog = "classpath:db/changelog/db.changelog-master.yaml"
            contexts = "base"
            defaultSchema = info.schema
        }
    }
}
