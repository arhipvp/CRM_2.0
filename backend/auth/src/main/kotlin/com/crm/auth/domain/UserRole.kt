package com.crm.auth.domain

import java.util.UUID
import org.springframework.data.annotation.Id
import org.springframework.data.relational.core.mapping.Column
import org.springframework.data.relational.core.mapping.Table

@Table("user_roles")
data class UserRole(
    @Id
    val id: Long? = null,
    @Column("user_id")
    val userId: UUID,
    @Column("role_id")
    val roleId: UUID
)
