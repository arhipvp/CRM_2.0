import type { DealStageMetrics } from "@/types/crm";

const stageLabels: Record<DealStageMetrics["stage"], string> = {
  qualification: "Квалификация",
  negotiation: "Переговоры",
  proposal: "Предложение",
  closedWon: "Успешные",
  closedLost: "Проваленные",
};

interface StageMetricsChartProps {
  metrics: DealStageMetrics[];
}

export function StageMetricsChart({ metrics }: StageMetricsChartProps) {
  const maxValue = metrics.reduce((acc, metric) => Math.max(acc, metric.count), 0);

  if (metrics.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {metrics.map((metric) => {
        const percent = maxValue > 0 ? Math.min(100, Math.max(4, Math.round((metric.count / maxValue) * 100))) : 0;

        return (
          <div key={metric.stage} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-600 dark:text-slate-200">{stageLabels[metric.stage]}</span>
              <span>{metric.count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                data-testid={`stage-bar-${metric.stage}`}
                style={{ width: `${percent}%` }}
                aria-label={`${stageLabels[metric.stage]}: ${metric.count}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
