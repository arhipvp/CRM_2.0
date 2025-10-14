package crm.audit.domain

import java.time.OffsetDateTime
import java.util.UUID
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.r2dbc.core.DatabaseClient
import org.springframework.stereotype.Repository

@Repository
class AuditEventTagRepositoryImpl(
    private val databaseClient: DatabaseClient
) : AuditEventTagRepository {

    override suspend fun saveAll(tags: Collection<AuditEventTagEntity>) {
        if (tags.isEmpty()) {
            return
        }

        for (tag in tags) {
            val executeSpec = databaseClient
                .sql(
                    """
                    INSERT INTO audit.audit_event_tags(event_id, event_occurred_at, tag_key, tag_value)
                    VALUES (:eventId, :eventOccurredAt, :tagKey, :tagValue)
                    ON CONFLICT (event_id, tag_key) DO UPDATE
                    SET tag_value = EXCLUDED.tag_value,
                        event_occurred_at = EXCLUDED.event_occurred_at
                    """.trimIndent()
                )
                .bind("eventId", tag.eventId)
                .bind("eventOccurredAt", tag.eventOccurredAt)
                .bind("tagKey", tag.tagKey)

            val completedSpec = if (tag.tagValue != null) {
                executeSpec.bind("tagValue", tag.tagValue)
            } else {
                executeSpec.bindNull("tagValue", String::class.java)
            }

            completedSpec
                .fetch()
                .rowsUpdated()
                .awaitSingle()
        }
    }

    override suspend fun findByEventId(eventId: UUID): List<AuditEventTagEntity> {
        return databaseClient
            .sql(
                """
                SELECT event_id, event_occurred_at, tag_key, tag_value
                FROM audit.audit_event_tags
                WHERE event_id = :eventId
                ORDER BY tag_key
                """.trimIndent()
            )
            .bind("eventId", eventId)
            .map { row, _ ->
                AuditEventTagEntity(
                    eventId = row.get("event_id", UUID::class.java)!!,
                    eventOccurredAt = row.get("event_occurred_at", OffsetDateTime::class.java)!!,
                    tagKey = row.get("tag_key", String::class.java)!!,
                    tagValue = row.get("tag_value", String::class.java)
                )
            }
            .all()
            .collectList()
            .awaitSingle()
    }
}
