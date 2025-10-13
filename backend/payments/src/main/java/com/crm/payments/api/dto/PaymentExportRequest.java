package com.crm.payments.api.dto;

import com.crm.payments.domain.PaymentExportFormat;
import com.crm.payments.domain.PaymentStatus;
import com.crm.payments.domain.PaymentType;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;

public class PaymentExportRequest {

    private UUID dealId;
    private UUID policyId;
    private List<PaymentStatus> statuses;
    private List<PaymentType> types;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private OffsetDateTime fromDate;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private OffsetDateTime toDate;

    @Positive
    @Max(200)
    private Integer limit;

    @PositiveOrZero
    private Integer offset;

    @NotNull
    private PaymentExportFormat format = PaymentExportFormat.CSV;

    public UUID getDealId() {
        return dealId;
    }

    public void setDealId(UUID dealId) {
        this.dealId = dealId;
    }

    public UUID getPolicyId() {
        return policyId;
    }

    public void setPolicyId(UUID policyId) {
        this.policyId = policyId;
    }

    public List<PaymentStatus> getStatuses() {
        return statuses;
    }

    public void setStatuses(List<PaymentStatus> statuses) {
        this.statuses = statuses;
    }

    public List<PaymentType> getTypes() {
        return types;
    }

    public void setTypes(List<PaymentType> types) {
        this.types = types;
    }

    public OffsetDateTime getFromDate() {
        return fromDate;
    }

    public void setFromDate(OffsetDateTime fromDate) {
        this.fromDate = fromDate;
    }

    public OffsetDateTime getToDate() {
        return toDate;
    }

    public void setToDate(OffsetDateTime toDate) {
        this.toDate = toDate;
    }

    public Integer getLimit() {
        return limit;
    }

    public void setLimit(Integer limit) {
        this.limit = limit;
    }

    public Integer getOffset() {
        return offset;
    }

    public void setOffset(Integer offset) {
        this.offset = offset;
    }

    public PaymentExportFormat getFormat() {
        return format;
    }

    public void setFormat(PaymentExportFormat format) {
        this.format = format;
    }

    @AssertTrue(message = "fromDate must be before toDate")
    public boolean isDateRangeValid() {
        if (fromDate == null || toDate == null) {
            return true;
        }
        return !fromDate.isAfter(toDate);
    }
}
