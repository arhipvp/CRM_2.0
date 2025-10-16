package com.crm.auth.service

import com.crm.auth.api.dto.RoleRequest
import com.crm.auth.domain.Role
import com.crm.auth.repository.RoleRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import java.util.UUID
import kotlinx.coroutines.test.runTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class RoleServiceTest {

    private val roleRepository: RoleRepository = mockk(relaxed = true)
    private val roleService = RoleService(roleRepository)

    @Test
    fun `should return existing role when creating role with same name different case`() = runTest {
        val existingRole = Role(
            id = UUID.randomUUID(),
            name = "ADMIN",
            description = "Existing description"
        )
        coEvery { roleRepository.findByName("ADMIN") } returns existingRole

        val request = RoleRequest(name = "admin", description = "New description")

        val response = roleService.createRole(request)

        assertThat(response.id).isEqualTo(existingRole.id)
        assertThat(response.name).isEqualTo(existingRole.name)
        assertThat(response.description).isEqualTo(existingRole.description)

        coVerify(exactly = 1) { roleRepository.findByName("ADMIN") }
        coVerify(exactly = 0) { roleRepository.save(any()) }
    }
}
