package com.crm.auth.repository

import com.crm.auth.domain.UserRole
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import org.springframework.data.repository.kotlin.CoroutineCrudRepository

interface UserRoleRepository : CoroutineCrudRepository<UserRole, Long> {
    fun findAllByUserId(userId: UUID): Flow<UserRole>

    suspend fun existsByUserIdAndRoleId(userId: UUID, roleId: UUID): Boolean

    suspend fun deleteByUserIdAndRoleId(userId: UUID, roleId: UUID)
}
