package com.crm.auth.api.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class AssignRoleRequest(
    @field:NotBlank
    @field:Size(max = 64)
    val roleName: String
)
