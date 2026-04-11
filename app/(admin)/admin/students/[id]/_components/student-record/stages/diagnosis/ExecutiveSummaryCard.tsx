"use client";

// ============================================
// F1: AI 종합 분석 카드 (진단 탭 인라인)
// PipelineExecutiveSummarySection(리포트용)의 경량 버전
// ============================================

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ExecutiveSummary } from "@/lib/domains/record-analysis/eval/executive-summary";
import { ChevronDown, TrendingUp, TrendingDown, Minus } from "lucide-react";

const GRADE_STYLE: Record<string, { bg: string; text: string; ring: string }> = {
  S: { bg: "bg-emerald-50 dark:bg-emerald-900/10", text: "text-emerald-700 dark:text-emerald-400", ring: "ring-emerald-200 dark:ring-emerald-800" },
  A: { bg: "bg-emerald-50 dark:bg-emerald-900/10", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-200 dark:ring-emerald-800" },
  B: { bg: "bg-blue-50 dark:bg-blue-900/10", text: "text-blue-700 dark:text-blue-400", ring: "ring-blue-200 dark:ring-blue-800" },
  C: { bg: "bg-amber-50 dark:bg-amber-900/10", text: "text-amber-700 dark:text-amber-400", ring: "ring-amber-200 dark:ring-amber-800" },
  D: { bg: "bg-red-50 dark:bg-red-900/10", text: "text-red-700 dark:text-red-400", ring: "ring-red-200 dark:ring-red-800" },
};

const TREND_LABEL: Record<string, { label: string; Icon: typeof TrendingUp }> = {
  rising: { label: "상승", Icon: TrendingUp },
  falling: { label: "하락", Icon: TrendingDown },
  stable: { label: "안정", Icon: Minus },
  volatile: { label: "변동", Icon: TrendingUp },
};

interface Props {
  summary: ExecutiveSummary;
}

export function ExecutiveSummaryCard({ summary }: Props) {
  const [expanded, setExpanded] = useState(false);
  const gc = GRADE_STYLE[summary.overallGrade] ?? GRADE_STYLE.C;
  const trend = summary.growthTrend ? TREND_LABEL[summary.growthTrend] : null;

  return (
    <div className="flex flex-col gap-3">
      {/* 상단: 종합 등급 + 점수 + 추세 */}
      <div className="flex items-center gap-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ring-2", gc.bg, gc.text, gc.ring)}>
          {summary.overallGrade}
        </div>
        <div>
          <p className="text-base font-bold text-[var(--text-primary)]">{summary.overallScore}점</p>
          {trend && (
            <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
              <trend.Icon size={12} />
              <span>성장 추세: {trend.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* 강점/약점 그리드 */}
      <div className="grid grid-cols-2 gap-2">
        {summary.topStrengths.length > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/10">
            <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">강점 역량</p>
            <ul className="mt-1 space-y-0.5">
              {summary.topStrengths.map((s) => (
                <li key={s.competencyId} className="text-xs text-emerald-600 dark:text-emerald-300">
                  {s.competencyName} <span className="text-[var(--text-tertiary)]">({s.score})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {summary.topWeaknesses.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/10">
            <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">보완 역량</p>
            <ul className="mt-1 space-y-0.5">
              {summary.topWeaknesses.map((s) => (
                <li key={s.competencyId} className="text-xs text-amber-600 dark:text-amber-300">
                  {s.competencyName} <span className="text-[var(--text-tertiary)]">({s.score})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 대학 매칭 */}
      {summary.topUniversityMatches && summary.topUniversityMatches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.topUniversityMatches.map((m) => (
            <span key={m.label} className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-900/10 dark:text-violet-400">
              {m.label} {m.grade} ({m.score})
            </span>
          ))}
        </div>
      )}

      {/* 상세 섹션 (접힌 상태) */}
      {(summary.sections.opinion || summary.sections.keyMetrics) && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            상세 분석
            <ChevronDown size={12} className={cn("transition-transform", expanded && "rotate-180")} />
          </button>
          {expanded && (
            <div className="mt-2 flex flex-col gap-2">
              {summary.sections.keyMetrics && <SectionBox title="핵심 지표" content={summary.sections.keyMetrics} />}
              {summary.sections.competencyProfile && <SectionBox title="역량 프로필" content={summary.sections.competencyProfile} />}
              {summary.sections.growthTrend && <SectionBox title="성장 추세" content={summary.sections.growthTrend} />}
              {summary.sections.universityFit && <SectionBox title="대학 적합도" content={summary.sections.universityFit} />}
              {summary.sections.opinion && <SectionBox title="종합 의견" content={summary.sections.opinion} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionBox({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2">
      <p className="text-[10px] font-semibold text-[var(--text-tertiary)]">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">{content}</p>
    </div>
  );
}
