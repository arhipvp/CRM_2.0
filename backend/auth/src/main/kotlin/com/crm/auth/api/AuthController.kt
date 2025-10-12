package com.crm.auth.api

import com.crm.auth.api.dto.RefreshTokenRequest
import com.crm.auth.api.dto.RegisterRequest
import com.crm.auth.api.dto.TokenRequest
import com.crm.auth.api.dto.TokenResponse
import com.crm.auth.api.dto.UserResponse
import com.crm.auth.service.TokenService
import com.crm.auth.service.UserService
import jakarta.validation.Valid
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val userService: UserService,
    private val tokenService: TokenService
) {

    @PostMapping("/register")
    suspend fun register(@Valid @RequestBody request: RegisterRequest): ResponseEntity<UserResponse> {
        val user = userService.register(request)
        return ResponseEntity.status(HttpStatus.CREATED).body(user)
    }

    @PostMapping("/token")
    suspend fun token(@Valid @RequestBody request: TokenRequest): TokenResponse =
        tokenService.issueTokens(request)

    @PostMapping("/refresh")
    suspend fun refresh(@Valid @RequestBody request: RefreshTokenRequest): TokenResponse =
        tokenService.refreshToken(request.refreshToken)

    @GetMapping("/me")
    suspend fun me(@AuthenticationPrincipal jwt: Jwt): UserResponse {
        val userId = UUID.fromString(jwt.subject)
        return userService.getUserWithRoles(userId)
    }
}
