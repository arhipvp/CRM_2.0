package com.crm.auth.api.dto

data class TokenResponse(
    val tokenType: String = "Bearer",
    val accessToken: String,
    val expiresIn: Long,
    val refreshToken: String?,
    val refreshExpiresIn: Long?
)
