package com.crm.payments.api.dto;

import com.crm.payments.domain.PaymentType;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public class PaymentRequest {

    @NotNull
    @JsonProperty("deal_id")
    @JsonAlias("dealId")
    private UUID dealId;

    @JsonProperty("policy_id")
    @JsonAlias("policyId")
    private UUID policyId;

    @NotNull
    @JsonProperty("initiator_user_id")
    @JsonAlias("initiatorUserId")
    private UUID initiatorUserId;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = false)
    private BigDecimal amount;

    @NotBlank
    private String currency;

    @JsonProperty("planned_date")
    @JsonAlias("dueDate")
    private OffsetDateTime dueDate;

    private String description;

    @NotNull
    @JsonProperty("payment_type")
    @JsonAlias("paymentType")
    private PaymentType paymentType;

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

    public UUID getInitiatorUserId() {
        return initiatorUserId;
    }

    public void setInitiatorUserId(UUID initiatorUserId) {
        this.initiatorUserId = initiatorUserId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public OffsetDateTime getDueDate() {
        return dueDate;
    }

    public void setDueDate(OffsetDateTime dueDate) {
        this.dueDate = dueDate;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public PaymentType getPaymentType() {
        return paymentType;
    }

    public void setPaymentType(PaymentType paymentType) {
        this.paymentType = paymentType;
    }
}
