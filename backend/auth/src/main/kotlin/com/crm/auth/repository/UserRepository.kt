package com.crm.auth.repository

import com.crm.auth.domain.User
import java.util.UUID
import org.springframework.data.repository.kotlin.CoroutineCrudRepository

interface UserRepository : CoroutineCrudRepository<User, UUID> {
    suspend fun findByEmail(email: String): User?
}
