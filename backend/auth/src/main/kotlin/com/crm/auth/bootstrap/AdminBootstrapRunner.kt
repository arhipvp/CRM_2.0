package com.crm.auth.bootstrap

import com.crm.auth.api.dto.RegisterRequest
import com.crm.auth.config.AdminBootstrapProperties
import com.crm.auth.domain.UserRole
import com.crm.auth.repository.UserRoleRepository
import com.crm.auth.service.RoleService
import com.crm.auth.service.UserService
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.stereotype.Component

@Component
class AdminBootstrapRunner(
    private val properties: AdminBootstrapProperties,
    private val userService: UserService,
    private val roleService: RoleService,
    private val userRoleRepository: UserRoleRepository
) : ApplicationRunner {

    private val logger = LoggerFactory.getLogger(AdminBootstrapRunner::class.java)

    override fun run(args: ApplicationArguments) {
        if (!properties.enabled) {
            return
        }

        val email = properties.email?.trim()?.lowercase()
        val password = properties.password
        val configuredRoles = properties.roles.mapNotNull { role ->
            val normalized = role.trim()
            if (normalized.isEmpty()) {
                null
            } else {
                normalized.uppercase()
            }
        }.ifEmpty { listOf("ROLE_ADMIN") }

        if (email.isNullOrBlank() || password.isNullOrBlank()) {
            logger.warn("Auth bootstrap is enabled but email or password is missing. Skipping bootstrap.")
            return
        }

        runBlocking {
            try {
                val existingUser = userService.findByEmail(email)
                val userId = if (existingUser == null) {
                    logger.info("Creating bootstrap admin user {}", email)
                    try {
                        val created = userService.register(RegisterRequest(email = email, password = password))
                        created.id
                    } catch (error: Exception) {
                        logger.error("Failed to create bootstrap user: {}", error.message)
                        return@runBlocking
                    }
                } else {
                    logger.info("Bootstrap user {} already exists", email)
                    existingUser.id
                }

                configuredRoles.forEach { roleName ->
                    try {
                        val role = roleService.ensureRole(roleName)
                        val alreadyAssigned = userRoleRepository.existsByUserIdAndRoleId(userId, role.id)
                        if (!alreadyAssigned) {
                            try {
                                userRoleRepository.save(UserRole(userId = userId, roleId = role.id))
                                logger.info("Assigned role {} to user {}", role.name, email)
                            } catch (error: Exception) {
                                logger.warn("Failed to assign role {} to user {}: {}", role.name, email, error.message)
                            }
                        } else {
                            logger.debug("Role {} already assigned to user {}", role.name, email)
                        }
                    } catch (error: Exception) {
                        logger.warn("Failed to ensure role {}: {}", roleName, error.message)
                    }
                }

                logger.info("Bootstrap completed successfully for user {}", email)
            } catch (error: Exception) {
                logger.error("Failed to run auth bootstrap: {}", error.message, error)
            }
        }
    }
}
