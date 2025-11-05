package com.crm.auth.service

import com.crm.auth.api.dto.TokenRequest
import com.crm.auth.api.dto.TokenResponse
import com.crm.auth.config.JwtProperties
import com.crm.auth.domain.User
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.reactor.awaitSingle
import kotlinx.coroutines.reactor.awaitSingleOrNull
import org.springframework.data.redis.core.ReactiveStringRedisTemplate
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException

@Service
class TokenService(
    private val userService: UserService,
    private val roleService: RoleService,
    private val jwtEncoder: JwtEncoder,
    private val redisTemplate: ReactiveStringRedisTemplate,
    private val properties: JwtProperties
) {

    suspend fun issueTokens(request: TokenRequest): TokenResponse {
        val user = userService.findByEmail(request.email)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials")

        // Check if user is enabled before validating password
        if (!user.enabled) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "User account is disabled")
        }

        if (!userService.validatePassword(user, request.password)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials")
        }

        val roles = roleService.getRolesForUser(user.id)
        val accessToken = encodeAccessToken(user, roles)
        val refreshToken = generateRefreshToken(user.id)
        return TokenResponse(
            accessToken = accessToken.tokenValue,
            expiresIn = properties.accessTokenTtl.seconds,
            refreshToken = refreshToken,
            refreshExpiresIn = properties.refreshTokenTtl.seconds
        )
    }

    suspend fun refreshToken(refreshToken: String): TokenResponse {
        val key = refreshKey(refreshToken)
        val userId = redisTemplate.opsForValue().get(key).awaitSingleOrNull()
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired")

        val uuid = runCatching { UUID.fromString(userId) }.getOrElse {
            redisTemplate.delete(key).awaitSingleOrNull()
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token")
        }

        val user = userService.getUserEntity(uuid)

        // Check if user is still enabled before refreshing tokens
        if (!user.enabled) {
            redisTemplate.delete(key).awaitSingleOrNull()
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "User account is disabled")
        }

        val roles = roleService.getRolesForUser(uuid)
        val accessToken = encodeAccessToken(user, roles)
        val newRefresh = generateRefreshToken(uuid)
        redisTemplate.delete(key).awaitSingleOrNull()
        return TokenResponse(
            accessToken = accessToken.tokenValue,
            expiresIn = properties.accessTokenTtl.seconds,
            refreshToken = newRefresh,
            refreshExpiresIn = properties.refreshTokenTtl.seconds
        )
    }

    private suspend fun encodeAccessToken(user: User, roles: List<com.crm.auth.domain.Role>) =
        jwtEncoder.encode(
            JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder()
                    .issuer(properties.issuer)
                    .audience(listOf(properties.audience))
                    .subject(user.id.toString())
                    .issuedAt(Instant.now())
                    .expiresAt(Instant.now().plus(properties.accessTokenTtl))
                    .claim("email", user.email)
                    .claim("roles", roles.map { it.name })
                    .build()
            )
        )

    private suspend fun generateRefreshToken(userId: UUID): String {
        val token = UUID.randomUUID().toString()
        redisTemplate.opsForValue()
            .set(refreshKey(token), userId.toString(), properties.refreshTokenTtl)
            .awaitSingle()
        return token
    }

    private fun refreshKey(token: String) = "auth:refresh:$token"
}
