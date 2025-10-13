package com.crm.audit

import com.crm.audit.api.AuditEventsController
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.context.annotation.Import

@SpringBootApplication
@Import(AuditEventsController::class)
class AuditApplication

fun main(args: Array<String>) {
    runApplication<AuditApplication>(*args)
}
