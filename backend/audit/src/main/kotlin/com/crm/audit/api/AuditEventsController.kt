package com.crm.audit.api

import com.crm.audit.api.dto.AuditEventsPageResponse
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import java.time.OffsetDateTime
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/audit")
@Validated
class AuditEventsController(
    private val auditEventQueryService: AuditEventQueryService
) {

    @GetMapping("/events")
    suspend fun getAuditEvents(
        @RequestParam(defaultValue = "0") @Min(0) page: Int,
        @RequestParam(defaultValue = "20") @Min(1) @Max(200) size: Int,
        @RequestParam(required = false) eventType: String?,
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        occurredAfter: OffsetDateTime?,
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
        occurredBefore: OffsetDateTime?
    ): AuditEventsPageResponse {
        val query = AuditEventsQuery(
            page = page,
            size = size,
            eventType = eventType?.takeIf { it.isNotBlank() },
            occurredAfter = occurredAfter,
            occurredBefore = occurredBefore
        )
        return auditEventQueryService.findEvents(query)
    }
}
