package com.crm.audit.api

import com.crm.audit.api.dto.AuditEventResponse
import com.crm.audit.api.dto.AuditEventsPageResponse
import com.crm.audit.api.dto.toResponse
import com.crm.audit.domain.AuditEventRepository
import java.time.OffsetDateTime
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.toList
import org.springframework.stereotype.Service

@Service
class AuditEventQueryService(
    private val auditEventRepository: AuditEventRepository
) {

    suspend fun findEvents(query: AuditEventsQuery): AuditEventsPageResponse {
        val page = query.page
        val size = query.size
        val offset = page * size

        val total = auditEventRepository.countEvents(
            query.eventType,
            query.occurredAfter,
            query.occurredBefore
        )

        if (total == 0L) {
            return AuditEventsPageResponse(
                content = emptyList(),
                page = page,
                size = size,
                totalElements = 0,
                totalPages = 0
            )
        }

        val content: List<AuditEventResponse> = auditEventRepository
            .findEvents(
                query.eventType,
                query.occurredAfter,
                query.occurredBefore,
                size,
                offset.toLong()
            )
            .map { it.toResponse() }
            .toList()

        val totalPages = ((total + size - 1) / size).toInt()

        return AuditEventsPageResponse(
            content = content,
            page = page,
            size = size,
            totalElements = total,
            totalPages = totalPages
        )
    }
}

data class AuditEventsQuery(
    val page: Int,
    val size: Int,
    val eventType: String?,
    val occurredAfter: OffsetDateTime?,
    val occurredBefore: OffsetDateTime?
)
