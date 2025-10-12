package com.crm.auth.api

import com.crm.auth.AbstractIntegrationTest
import com.crm.auth.api.dto.AssignRoleRequest
import com.crm.auth.api.dto.RegisterRequest
import com.crm.auth.api.dto.RoleRequest
import com.crm.auth.api.dto.TokenRequest
import com.crm.auth.repository.RoleRepository
import com.crm.auth.repository.UserRepository
import com.crm.auth.repository.UserRoleRepository
import com.fasterxml.jackson.databind.ObjectMapper
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.reactive.server.WebTestClient

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
class AuthApiTest @Autowired constructor(
    private val webTestClient: WebTestClient,
    private val userRepository: UserRepository,
    private val roleRepository: RoleRepository,
    private val userRoleRepository: UserRoleRepository,
    private val objectMapper: ObjectMapper
) : AbstractIntegrationTest() {

    @BeforeEach
    fun cleanUp() = runBlocking {
        userRoleRepository.deleteAll()
        userRepository.deleteAll()
        roleRepository.deleteAll()
    }

    @Test
    fun `should register and issue tokens`() = runBlocking {
        val registerRequest = RegisterRequest(email = "admin@example.com", password = "SecureP@ssw0rd")

        webTestClient.post()
            .uri("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(registerRequest)
            .exchange()
            .expectStatus().isCreated
            .expectBody()
            .jsonPath("$.email").isEqualTo("admin@example.com")

        val adminUser = userRepository.findByEmail("admin@example.com")
        assertThat(adminUser).isNotNull

        val adminRole = roleRepository.findByName("ROLE_ADMIN") ?: roleRepository.save(
            com.crm.auth.domain.Role(name = "ROLE_ADMIN")
        )
        userRoleRepository.save(com.crm.auth.domain.UserRole(userId = adminUser!!.id, roleId = adminRole.id))

        val tokenResponse = webTestClient.post()
            .uri("/api/auth/token")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(TokenRequest(email = "admin@example.com", password = "SecureP@ssw0rd"))
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.accessToken").isNotEmpty
            .jsonPath("$.refreshToken").isNotEmpty
            .returnResult()

        val tokenJson = tokenResponse.responseBody?.let { objectMapper.readTree(it) }
        val accessToken = tokenJson?.get("accessToken")?.asText()
        val refreshToken = tokenJson?.get("refreshToken")?.asText()

        assertThat(accessToken).isNotBlank
        assertThat(refreshToken).isNotBlank

        webTestClient.post()
            .uri("/api/roles")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer $accessToken")
            .bodyValue(RoleRequest(name = "ROLE_MANAGER", description = "Manager"))
            .exchange()
            .expectStatus().isCreated
            .expectBody()
            .jsonPath("$.name").isEqualTo("ROLE_MANAGER")

        webTestClient.post()
            .uri("/api/users/${adminUser.id}/roles")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer $accessToken")
            .bodyValue(AssignRoleRequest(roleName = "ROLE_MANAGER"))
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.roles[?(@.name=='ROLE_MANAGER')]").exists()

        webTestClient.get()
            .uri("/api/auth/me")
            .header("Authorization", "Bearer $accessToken")
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.email").isEqualTo("admin@example.com")

        val refreshResponse = webTestClient.post()
            .uri("/api/auth/refresh")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(mapOf("refreshToken" to refreshToken))
            .exchange()
            .expectStatus().isOk
            .expectBody()
            .jsonPath("$.accessToken").isNotEmpty
            .returnResult()
        val newAccessToken = refreshResponse.responseBody?.let { objectMapper.readTree(it).get("accessToken")?.asText() }
        assertThat(newAccessToken).isNotBlank
    }
}
