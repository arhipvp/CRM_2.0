package crm.audit.domain

import java.util.UUID

interface AuditEventTagRepository {

    suspend fun saveAll(tags: Collection<AuditEventTagEntity>)

    suspend fun findByEventId(eventId: UUID): List<AuditEventTagEntity>
}
