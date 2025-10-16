package com.crm.auth.service

import com.crm.auth.api.dto.RoleRequest
import com.crm.auth.api.dto.RoleResponse
import com.crm.auth.domain.Role
import com.crm.auth.repository.RoleRepository
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class RoleService(
    private val roleRepository: RoleRepository
) {

    suspend fun listRoles(): List<RoleResponse> = roleRepository.findAll().map { it.toDto() }.toList()

    @Transactional
    suspend fun createRole(request: RoleRequest): RoleResponse {
        val normalizedName = request.name.uppercase(Locale.ROOT)
        roleRepository.findByName(normalizedName)?.let { existing ->
            return existing.toDto()
        }
        val role = Role(name = normalizedName, description = request.description)
        return roleRepository.save(role).toDto()
    }

    @Transactional
    suspend fun ensureRole(name: String): Role {
        val normalized = name.uppercase(Locale.ROOT)
        return roleRepository.findByName(normalized) ?: roleRepository.save(Role(name = normalized))
    }

    suspend fun findByName(name: String): Role? = roleRepository.findByName(name.uppercase(Locale.ROOT))

    suspend fun getRolesForUser(userId: UUID): List<Role> = roleRepository.findAllByUserId(userId).toList()

    private fun Role.toDto() = RoleResponse(id = id, name = name, description = description)
}
