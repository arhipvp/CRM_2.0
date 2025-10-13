package com.crm.payments.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "payments.exports")
public class PaymentExportProperties {

    private String queue = "payments.exports";

    private String statusQueue = "payments.exports.status";

    private final Storage storage = new Storage();

    public String getQueue() {
        return queue;
    }

    public void setQueue(String queue) {
        this.queue = queue;
    }

    public String getStatusQueue() {
        return statusQueue;
    }

    public void setStatusQueue(String statusQueue) {
        this.statusQueue = statusQueue;
    }

    public Storage getStorage() {
        return storage;
    }

    public static class Storage {

        private String bucket;

        private String prefix = "payments/exports";

        private String baseUrl;

        private Duration urlTtl = Duration.ofHours(24);

        public String getBucket() {
            return bucket;
        }

        public void setBucket(String bucket) {
            this.bucket = bucket;
        }

        public String getPrefix() {
            return prefix;
        }

        public void setPrefix(String prefix) {
            this.prefix = prefix;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public Duration getUrlTtl() {
            return urlTtl;
        }

        public void setUrlTtl(Duration urlTtl) {
            this.urlTtl = urlTtl;
        }
    }
}
