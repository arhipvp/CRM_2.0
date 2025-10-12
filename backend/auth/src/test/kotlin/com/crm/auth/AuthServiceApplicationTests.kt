package com.crm.auth

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthServiceApplicationTests : AbstractIntegrationTest() {

    @Test
    fun contextLoads() {
        // контекст поднимается с Testcontainers
    }
}
