package com.crm.auth.repository

import com.crm.auth.AbstractIntegrationTest
import com.crm.auth.domain.User
import java.time.OffsetDateTime
import java.util.UUID
import kotlinx.coroutines.test.runTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest
class UserRepositoryTest @Autowired constructor(
    private val userRepository: UserRepository
) : AbstractIntegrationTest() {

    @Test
    fun `should save and load user`() = runTest {
        val now = OffsetDateTime.now()
        val user = User(
            id = UUID.randomUUID(),
            email = "user@example.com",
            passwordHash = "hashed",
            createdAt = now,
            updatedAt = now
        )
        userRepository.save(user)
        val loaded = userRepository.findByEmail("user@example.com")
        assertThat(loaded).isNotNull
        assertThat(loaded?.email).isEqualTo("user@example.com")
    }
}
