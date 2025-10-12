package com.crm.auth.repository

import com.crm.auth.domain.Role
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import org.springframework.data.r2dbc.repository.Query
import org.springframework.data.repository.kotlin.CoroutineCrudRepository

interface RoleRepository : CoroutineCrudRepository<Role, UUID> {
    suspend fun findByName(name: String): Role?

    @Query("""
        SELECT r.* FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = :userId
    """)
    fun findAllByUserId(userId: UUID): Flow<Role>
}
