package com.crm.auth.api.dto

import java.util.UUID

data class RoleResponse(
    val id: UUID,
    val name: String,
    val description: String?
)
