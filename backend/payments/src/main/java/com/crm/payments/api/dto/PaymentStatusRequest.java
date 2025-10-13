package com.crm.payments.api.dto;

import com.crm.payments.domain.PaymentStatus;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;

public class PaymentStatusRequest {

    @NotNull
    private PaymentStatus status;

    @JsonProperty("actual_date")
    @JsonAlias("actualDate")
    @PastOrPresent
    private OffsetDateTime actualDate;

    @JsonProperty("confirmation_reference")
    @JsonAlias("confirmationReference")
    @Size(max = 128)
    private String confirmationReference;

    @Size(max = 1024)
    private String comment;

    public PaymentStatus getStatus() {
        return status;
    }

    public void setStatus(PaymentStatus status) {
        this.status = status;
    }

    public OffsetDateTime getActualDate() {
        return actualDate;
    }

    public void setActualDate(OffsetDateTime actualDate) {
        this.actualDate = actualDate;
    }

    public String getConfirmationReference() {
        return confirmationReference;
    }

    public void setConfirmationReference(String confirmationReference) {
        this.confirmationReference = confirmationReference;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }
}
