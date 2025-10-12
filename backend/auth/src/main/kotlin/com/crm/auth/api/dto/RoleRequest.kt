package com.crm.auth.api.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class RoleRequest(
    @field:NotBlank
    @field:Size(max = 64)
    val name: String,
    @field:Size(max = 255)
    val description: String? = null
)
