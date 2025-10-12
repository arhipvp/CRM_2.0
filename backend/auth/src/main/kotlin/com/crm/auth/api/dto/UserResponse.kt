package com.crm.auth.api.dto

import java.time.OffsetDateTime
import java.util.UUID

data class UserResponse(
    val id: UUID,
    val email: String,
    val enabled: Boolean,
    val roles: List<RoleResponse>,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime
)
