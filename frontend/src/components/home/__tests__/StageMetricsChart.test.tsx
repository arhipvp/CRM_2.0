import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { StageMetricsChart } from "@/components/home/StageMetricsChart";
import type { DealStageMetrics } from "@/types/crm";

const sampleMetrics: DealStageMetrics[] = [
  { stage: "qualification", count: 10, totalValue: 200000, conversionRate: 0.2, avgCycleDurationDays: 12 },
  { stage: "negotiation", count: 5, totalValue: 150000, conversionRate: 0.4, avgCycleDurationDays: 18 },
  { stage: "closedWon", count: 3, totalValue: 300000, conversionRate: 1, avgCycleDurationDays: 25 },
];

describe("StageMetricsChart", () => {
  it("отрисовывает гистограмму с пропорциональной шириной", () => {
    render(<StageMetricsChart metrics={sampleMetrics} />);

    const qualificationBar = screen.getByTestId("stage-bar-qualification");
    const negotiationBar = screen.getByTestId("stage-bar-negotiation");
    const closedWonBar = screen.getByTestId("stage-bar-closedWon");

    expect(qualificationBar).toHaveStyle({ width: "100%" });
    expect(negotiationBar).toHaveStyle({ width: "50%" });
    expect(closedWonBar).toHaveStyle({ width: "30%" });
  });

  it("ничего не рендерит без данных", () => {
    const { container } = render(<StageMetricsChart metrics={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
