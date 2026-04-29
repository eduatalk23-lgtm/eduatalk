"use client";

import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { cn } from "@/lib/cn";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import type { TimeSeriesAnalysis, CompetencyTrend } from "@/lib/domains/record-analysis/eval/timeseries-analyzer";

function competencyLabel(id: string): string {
  return COMPETENCY_ITEMS.find((i) => i.code === id)?.label ?? id;
}

interface Props {
  analysis: TimeSeriesAnalysis;
}

const TREND_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  rising: { icon: TrendingUp, color: "text-emerald-600", label: "상승" },
  falling: { icon: TrendingDown, color: "text-red-600", label: "하락" },
  stable: { icon: Minus, color: "text-text-tertiary", label: "안정" },
  volatile: { icon: AlertTriangle, color: "text-amber-600", label: "변동" },
};

function TrendBadge({ trend }: { trend: CompetencyTrend }) {
  const cfg = TREND_CONFIG[trend.trend] ?? TREND_CONFIG.stable;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", cfg.color)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

export function TimeSeriesSection({ analysis }: Props) {
  if (analysis.trends.length === 0) return null;

  return (
    <div>
      <ReportSectionHeader
        icon={TrendingUp}
        title="3년 성장 분석"
        subtitle={analysis.summary}
      />

      {/* 요약 카드 */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="전체 성장률" value={`${analysis.overallGrowthRate > 0 ? "+" : ""}${analysis.overallGrowthRate.toFixed(1)}`} />
        <MetricCard label="최강 역량" value={competencyLabel(analysis.strongestCompetency)} />
        <MetricCard label="최약 역량" value={competencyLabel(analysis.weakestCompetency)} />
        <MetricCard label="최대 성장" value={competencyLabel(analysis.mostImprovedCompetency)} />
      </div>

      {/* 역량별 추이 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium text-text-secondary">역량</th>
              <th className="py-2 text-center font-medium text-text-secondary">추세</th>
              <th className="py-2 text-center font-medium text-text-secondary">성장률</th>
              <th className="py-2 text-left font-medium text-text-secondary">점수 변화</th>
            </tr>
          </thead>
          <tbody>
            {analysis.trends.map((t) => (
              <tr key={t.competencyId} className={cn("border-b border-border", t.isAnomaly && "bg-amber-50/50")}>
                <td className="py-2">
                  {t.competencyName}
                  {t.isAnomaly && (
                    <span className="ml-1 text-3xs text-amber-600" title={t.anomalyReason}>
                      ⚠ {t.anomalyReason}
                    </span>
                  )}
                </td>
                <td className="py-2 text-center"><TrendBadge trend={t} /></td>
                <td className={cn("py-2 text-center font-medium", t.growthRate > 0 ? "text-emerald-600" : t.growthRate < 0 ? "text-red-600" : "text-text-tertiary")}>
                  {t.growthRate > 0 ? "+" : ""}{t.growthRate.toFixed(1)}
                </td>
                <td className="py-2 text-text-tertiary">
                  {t.points.map((p) => p.score.toFixed(0)).join(" → ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 이상 징후 */}
      {analysis.anomalies.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-700">이상 징후 {analysis.anomalies.length}건</p>
          <ul className="mt-1 space-y-1">
            {analysis.anomalies.map((a) => (
              <li key={a.competencyId} className="text-xs text-amber-600">
                {a.competencyName}: {a.anomalyReason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}
