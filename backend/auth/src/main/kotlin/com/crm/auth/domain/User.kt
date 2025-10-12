package com.crm.auth.domain

import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.data.annotation.Id
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table

@Table("users")
data class User(
    @Id
    val id: UUID = UUID.randomUUID(),
    @Column("email")
    val email: String,
    @Column("password_hash")
    val passwordHash: String,
    @Column("enabled")
    val enabled: Boolean = true,
    @Column("created_at")
    val createdAt: OffsetDateTime = OffsetDateTime.now(),
    @Column("updated_at")
    val updatedAt: OffsetDateTime = OffsetDateTime.now()
)
