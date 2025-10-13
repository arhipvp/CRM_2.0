package com.crm.payments.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum PaymentExportStatus {
    PROCESSING("processing"),
    DONE("done"),
    FAILED("failed");

    private final String value;

    PaymentExportStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static PaymentExportStatus fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (PaymentExportStatus status : values()) {
            if (status.value.equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown export status: " + value);
    }

    @Override
    public String toString() {
        return value;
    }
}
