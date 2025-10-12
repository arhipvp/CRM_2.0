package com.crm.auth.domain

import java.util.UUID
import org.springframework.data.annotation.Id
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table

@Table("roles")
data class Role(
    @Id
    val id: UUID = UUID.randomUUID(),
    @Column("name")
    val name: String,
    @Column("description")
    val description: String? = null
)
