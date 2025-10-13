package com.crm.payments.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.crm.payments.api.dto.PaymentListRequest;
import com.crm.payments.domain.PaymentStatus;
import com.crm.payments.domain.PaymentType;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.data.relational.core.query.Criteria;
import org.springframework.data.relational.core.query.CriteriaDefinition;
import org.springframework.test.util.ReflectionTestUtils;

class PaymentRepositoryCustomImplTest {

    private PaymentRepositoryCustomImpl repository;

    @BeforeEach
    void setUp() {
        repository = new PaymentRepositoryCustomImpl(Mockito.mock(R2dbcEntityTemplate.class));
    }

    @Test
    void buildCriteriaIncludesStatusAndTypeFilters() {
        PaymentListRequest request = new PaymentListRequest();
        request.setStatus(PaymentStatus.COMPLETED);
        request.setType(PaymentType.REFUND);

        @SuppressWarnings("unchecked")
        List<CriteriaDefinition> criteria = ReflectionTestUtils.invokeMethod(repository, "buildCriteria", request);

        assertThat(criteria).hasSize(2);

        Criteria statusCriteria = findCriteria(criteria, "status");
        assertThat(statusCriteria.getComparator()).isEqualTo(CriteriaDefinition.Comparator.IN);
        assertThat(statusCriteria.getValue()).isInstanceOf(List.class);
        List<?> statusValues = (List<?>) statusCriteria.getValue();
        assertThat(statusValues).hasSize(1);
        assertThat(statusValues.get(0).toString()).isEqualTo(PaymentStatus.COMPLETED.name());

        Criteria typeCriteria = findCriteria(criteria, "payment_type");
        assertThat(typeCriteria.getComparator()).isEqualTo(CriteriaDefinition.Comparator.IN);
        assertThat(typeCriteria.getValue()).isInstanceOf(List.class);
        List<?> typeValues = (List<?>) typeCriteria.getValue();
        assertThat(typeValues).hasSize(1);
        assertThat(typeValues.get(0).toString()).isEqualTo(PaymentType.REFUND.name());
    }

    private Criteria findCriteria(List<CriteriaDefinition> criteria, String column) {
        return criteria.stream()
                .map(Criteria.class::cast)
                .filter(entry -> column.equals(entry.getColumn().getReference()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Criteria for column '" + column + "' not found"));
    }
}
