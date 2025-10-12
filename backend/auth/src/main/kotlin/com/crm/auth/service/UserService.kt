package com.crm.auth.service

import com.crm.auth.api.dto.AssignRoleRequest
import com.crm.auth.api.dto.RegisterRequest
import com.crm.auth.api.dto.RoleResponse
import com.crm.auth.api.dto.UserResponse
import com.crm.auth.domain.Role
import com.crm.auth.domain.User
import com.crm.auth.domain.UserRole
import com.crm.auth.repository.UserRepository
import com.crm.auth.repository.UserRoleRepository
import java.time.OffsetDateTime
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
class UserService(
    private val userRepository: UserRepository,
    private val userRoleRepository: UserRoleRepository,
    private val roleService: RoleService,
    private val passwordEncoder: PasswordEncoder
) {

    private val defaultRole = "ROLE_USER"

    @Transactional
    suspend fun register(request: RegisterRequest): UserResponse {
        userRepository.findByEmail(request.email.lowercase(Locale.ROOT))?.let {
            throw ResponseStatusException(HttpStatus.CONFLICT, "User already exists")
        }
        val now = OffsetDateTime.now()
        val user = User(
            email = request.email.lowercase(Locale.ROOT),
            passwordHash = passwordEncoder.encode(request.password),
            createdAt = now,
            updatedAt = now
        )
        val saved = userRepository.save(user)
        val baseRole = roleService.ensureRole(defaultRole)
        userRoleRepository.save(UserRole(userId = saved.id, roleId = baseRole.id))
        return toDto(saved, listOf(baseRole))
    }

    suspend fun findByEmail(email: String): User? = userRepository.findByEmail(email.lowercase(Locale.ROOT))

    suspend fun validatePassword(user: User, rawPassword: String): Boolean =
        passwordEncoder.matches(rawPassword, user.passwordHash)

    suspend fun getUserWithRoles(userId: UUID): UserResponse {
        val user = userRepository.findById(userId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        val roles = roleService.getRolesForUser(userId)
        return toDto(user, roles)
    }

    suspend fun getUserEntity(userId: UUID): User =
        userRepository.findById(userId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")

    suspend fun assignRole(userId: UUID, request: AssignRoleRequest): UserResponse {
        val user = userRepository.findById(userId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        val role = roleService.ensureRole(request.roleName)
        val exists = userRoleRepository.existsByUserIdAndRoleId(userId, role.id)
        if (!exists) {
            userRoleRepository.save(UserRole(userId = userId, roleId = role.id))
        }
        val roles = roleService.getRolesForUser(userId)
        return toDto(user, roles)
    }

    suspend fun removeRole(userId: UUID, roleName: String): UserResponse {
        val user = userRepository.findById(userId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")
        val normalized = roleName.uppercase(Locale.ROOT)
        if (normalized == defaultRole) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot remove default role")
        }
        val role = roleService.findByName(normalized)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found")
        userRoleRepository.deleteByUserIdAndRoleId(userId, role.id)
        val roles = roleService.getRolesForUser(userId)
        return toDto(user, roles)
    }

    suspend fun listUsers(): List<UserResponse> {
        return userRepository.findAll()
            .map { user ->
                val roles = roleService.getRolesForUser(user.id)
                toDto(user, roles)
            }
            .toList()
    }

    fun toDto(user: User, roles: List<Role>): UserResponse {
        val roleResponses = roles.sortedBy { it.name }.map { RoleResponse(id = it.id, name = it.name, description = it.description) }
        return UserResponse(
            id = user.id,
            email = user.email,
            enabled = user.enabled,
            roles = roleResponses,
            createdAt = user.createdAt,
            updatedAt = user.updatedAt
        )
    }
}
