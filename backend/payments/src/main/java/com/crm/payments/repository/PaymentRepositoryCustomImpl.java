package com.crm.payments.repository;

import com.crm.payments.api.dto.PaymentListRequest;
import com.crm.payments.domain.PaymentEntity;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.data.relational.core.query.Criteria;
import org.springframework.data.relational.core.query.CriteriaDefinition;
import org.springframework.data.relational.core.query.Query;
import reactor.core.publisher.Flux;

public class PaymentRepositoryCustomImpl implements PaymentRepositoryCustom {

    private static final Sort SORT_BY_CREATED_AT_DESC = Sort.by(Sort.Order.desc("created_at"));

    private final R2dbcEntityTemplate entityTemplate;

    public PaymentRepositoryCustomImpl(R2dbcEntityTemplate entityTemplate) {
        this.entityTemplate = entityTemplate;
    }

    @Override
    public Flux<PaymentEntity> findAll(PaymentListRequest request) {
        Query query = buildQuery(request)
                .sort(SORT_BY_CREATED_AT_DESC)
                .limit(request.getResolvedLimit())
                .offset(request.getResolvedOffset());

        return entityTemplate.select(query, PaymentEntity.class);
    }

    private Query buildQuery(PaymentListRequest request) {
        List<CriteriaDefinition> criteriaDefinitions = buildCriteria(request);

        if (criteriaDefinitions.isEmpty()) {
            return Query.empty();
        }

        Criteria combined = (Criteria) criteriaDefinitions.get(0);
        for (int i = 1; i < criteriaDefinitions.size(); i++) {
            combined = combined.and((Criteria) criteriaDefinitions.get(i));
        }
        return Query.query(combined);
    }

    private List<CriteriaDefinition> buildCriteria(PaymentListRequest request) {
        List<CriteriaDefinition> criteria = new ArrayList<>();

        if (request.getDealId() != null) {
            criteria.add(Criteria.where("deal_id").is(request.getDealId()));
        }

        if (request.getPolicyId() != null) {
            criteria.add(Criteria.where("policy_id").is(request.getPolicyId()));
        }

        if (!request.getStatuses().isEmpty()) {
            List<String> statuses = request.getStatuses().stream()
                    .map(Enum::name)
                    .collect(Collectors.toList());
            criteria.add(Criteria.where("status").in(statuses));
        }

        if (!request.getTypes().isEmpty()) {
            List<String> types = request.getTypes().stream()
                    .map(Enum::name)
                    .collect(Collectors.toList());
            criteria.add(Criteria.where("payment_type").in(types));
        }

        if (request.getFromDate() != null) {
            criteria.add(Criteria.where("created_at").greaterThanOrEquals(request.getFromDate()));
        }

        if (request.getToDate() != null) {
            criteria.add(Criteria.where("created_at").lessThanOrEquals(request.getToDate()));
        }

        return criteria;
    }
}
