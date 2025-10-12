package com.crm.auth.api

import com.crm.auth.api.dto.AssignRoleRequest
import com.crm.auth.api.dto.UserResponse
import com.crm.auth.service.UserService
import jakarta.validation.Valid
import java.util.UUID
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/users")
class UserController(
    private val userService: UserService
) {

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    suspend fun listUsers(): List<UserResponse> = userService.listUsers()

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    suspend fun getUser(@PathVariable id: UUID): UserResponse = userService.getUserWithRoles(id)

    @PostMapping("/{id}/roles")
    @PreAuthorize("hasRole('ADMIN')")
    suspend fun assignRole(@PathVariable id: UUID, @Valid @RequestBody request: AssignRoleRequest): UserResponse =
        userService.assignRole(id, request)

    @DeleteMapping("/{id}/roles/{role}")
    @PreAuthorize("hasRole('ADMIN')")
    suspend fun removeRole(@PathVariable id: UUID, @PathVariable role: String): UserResponse =
        userService.removeRole(id, role)
}
