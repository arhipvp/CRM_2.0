package com.crm.auth.api

import com.crm.auth.api.dto.RoleRequest
import com.crm.auth.api.dto.RoleResponse
import com.crm.auth.service.RoleService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/roles")
class RoleController(
    private val roleService: RoleService
) {

    @GetMapping
    suspend fun listRoles(): List<RoleResponse> = roleService.listRoles()

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    suspend fun createRole(@Valid @RequestBody request: RoleRequest): ResponseEntity<RoleResponse> {
        val role = roleService.createRole(request)
        return ResponseEntity.status(HttpStatus.CREATED).body(role)
    }
}
