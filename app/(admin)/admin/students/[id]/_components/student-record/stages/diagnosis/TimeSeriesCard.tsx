"use client";

// ============================================
// F4: 역량 시계열 분석 카드 (진단 탭 인라인)
// ============================================

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { TimeSeriesAnalysis, CompetencyTrend, TrendType } from "@/lib/domains/record-analysis/eval/timeseries-analyzer";
import { TrendingUp, TrendingDown, Minus, Activity, ChevronDown, AlertTriangle } from "lucide-react";

const TREND_META: Record<TrendType, { label: string; Icon: typeof TrendingUp; color: string }> = {
  rising: { label: "상승", Icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
  falling: { label: "하락", Icon: TrendingDown, color: "text-red-600 dark:text-red-400" },
  stable: { label: "안정", Icon: Minus, color: "text-blue-600 dark:text-blue-400" },
  volatile: { label: "변동", Icon: Activity, color: "text-amber-600 dark:text-amber-400" },
};

interface Props {
  analysis: TimeSeriesAnalysis;
}

export function TimeSeriesCard({ analysis }: Props) {
  const [expanded, setExpanded] = useState(false);

  const growthSign = analysis.overallGrowthRate >= 0 ? "+" : "";
  const growthColor = analysis.overallGrowthRate > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : analysis.overallGrowthRate < 0
      ? "text-red-600 dark:text-red-400"
      : "text-[var(--text-tertiary)]";

  return (
    <div className="flex flex-col gap-3">
      {/* 상단: 전체 성장률 + 요약 */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-4 py-2">
          <span className={cn("text-lg font-bold", growthColor)}>
            {growthSign}{analysis.overallGrowthRate.toFixed(1)}
          </span>
          <span className="text-3xs text-[var(--text-tertiary)]">전체 성장률</span>
        </div>
        <p className="flex-1 text-xs text-[var(--text-secondary)]">{analysis.summary}</p>
      </div>

      {/* 이상 감지 경고 */}
      {analysis.anomalies.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/10">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex flex-col gap-0.5">
            {analysis.anomalies.map((a) => (
              <span key={a.competencyId} className="text-xs text-amber-700 dark:text-amber-400">
                {a.competencyName}: {a.anomalyReason}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 역량별 추세 미니 그리드 */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {analysis.trends.map((t) => {
          const meta = TREND_META[t.trend];
          return (
            <div key={t.competencyId} className={cn(
              "flex items-center gap-1.5 rounded-md border border-[var(--border-primary)] px-2 py-1.5",
              t.isAnomaly && "border-amber-300 dark:border-amber-700",
            )}>
              <meta.Icon size={12} className={meta.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-3xs font-medium text-[var(--text-primary)]">{t.competencyName}</p>
                <p className="text-3xs text-[var(--text-tertiary)]">
                  {meta.label} ({t.growthRate >= 0 ? "+" : ""}{t.growthRate.toFixed(1)})
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 상세 (접힌 상태) */}
      {analysis.trends.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            학년별 상세
            <ChevronDown size={12} className={cn("transition-transform", expanded && "rotate-180")} />
          </button>
          {expanded && (
            <div className="mt-2 flex flex-col gap-2">
              {analysis.trends.map((t) => (
                <TrendDetail key={t.competencyId} trend={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrendDetail({ trend }: { trend: CompetencyTrend }) {
  const meta = TREND_META[trend.trend];
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2">
      <div className="flex items-center gap-2">
        <meta.Icon size={12} className={meta.color} />
        <span className="text-xs font-medium text-[var(--text-primary)]">{trend.competencyName}</span>
        <span className={cn("text-3xs font-medium", meta.color)}>{meta.label}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        {trend.points.map((p, i) => (
          <span key={p.gradeYear} className="flex items-center gap-1">
            <span className="text-3xs text-[var(--text-tertiary)]">{p.gradeYear}학년</span>
            <span className="text-xs font-medium text-[var(--text-primary)]">{p.score}</span>
            {i < trend.points.length - 1 && <span className="text-3xs text-[var(--text-quaternary)]">→</span>}
          </span>
        ))}
      </div>
      {trend.isAnomaly && trend.anomalyReason && (
        <p className="mt-1 text-3xs text-amber-600 dark:text-amber-400">{trend.anomalyReason}</p>
      )}
    </div>
  );
}
