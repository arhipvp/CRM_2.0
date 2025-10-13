package com.crm.payments.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum PaymentExportFormat {
    CSV("csv"),
    XLSX("xlsx");

    private final String value;

    PaymentExportFormat(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static PaymentExportFormat fromValue(String value) {
        if (value == null) {
            return null;
        }
        for (PaymentExportFormat format : values()) {
            if (format.value.equalsIgnoreCase(value)) {
                return format;
            }
        }
        throw new IllegalArgumentException("Unknown export format: " + value);
    }

    @Override
    public String toString() {
        return value;
    }
}
