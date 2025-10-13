package com.crm.payments.api.dto;

import com.crm.payments.domain.PaymentExportStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class PaymentExportResponse {

    @JsonProperty("job_id")
    private UUID jobId;

    private PaymentExportStatus status;

    @JsonProperty("download_url")
    private String downloadUrl;

    public PaymentExportResponse() {
    }

    public PaymentExportResponse(UUID jobId, PaymentExportStatus status, String downloadUrl) {
        this.jobId = jobId;
        this.status = status;
        this.downloadUrl = downloadUrl;
    }

    public UUID getJobId() {
        return jobId;
    }

    public void setJobId(UUID jobId) {
        this.jobId = jobId;
    }

    public PaymentExportStatus getStatus() {
        return status;
    }

    public void setStatus(PaymentExportStatus status) {
        this.status = status;
    }

    public String getDownloadUrl() {
        return downloadUrl;
    }

    public void setDownloadUrl(String downloadUrl) {
        this.downloadUrl = downloadUrl;
    }
}
