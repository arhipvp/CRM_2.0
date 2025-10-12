package com.crm.auth.api.dto

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank


data class TokenRequest(
    @field:Email
    @field:NotBlank
    val email: String,
    @field:NotBlank
    val password: String
)
