"use client";

// ============================================
// Phase 6.5 — 조기 경보 패널
// E2: 경고 히스토리 (신규/해결됨/지속 표시)
// ============================================

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { RecordWarning, RecordWarningCategory, RecordWarningRuleId, RecordWarningSeverity } from "@/lib/domains/student-record/warnings/types";
import type { WarningDiff } from "@/lib/domains/student-record/warnings/history-types";
import { getWarningChangeStatus } from "@/lib/domains/student-record/warnings/history";
import { WARNING_LABELS } from "@/lib/domains/student-record/warnings/types";
import { AlertTriangle, BookOpen, GraduationCap, LineChart, CheckCircle, ExternalLink, Target, ChevronDown } from "lucide-react";

/** 경고 ruleId → 이동할 섹션 ID */
const RULE_SECTION_MAP: Partial<Record<RecordWarningRuleId, string>> = {
  missing_career_activity: "sec-changche",
  changche_empty: "sec-changche",
  haengteuk_draft: "sec-haengteuk",
  reading_insufficient: "sec-reading",
  course_inadequacy: "sec-diagnosis-adequacy",
  storyline_weak: "sec-storyline",
  storyline_gap: "sec-storyline",
  min_score_critical: "sec-min-score",
  min_score_bottleneck: "sec-min-score",
  min_score_trend_down: "sec-min-score",
  major_subject_decline: "sec-setek",
  no_applications: "sec-applications",
  strategy_incomplete: "sec-compensation",
};

type Props = {
  warnings: RecordWarning[];
  warningDiff?: WarningDiff | null;
};

const SEVERITY_STYLE: Record<RecordWarningSeverity, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-50 dark:bg-red-900/10", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
  high: { bg: "bg-orange-50 dark:bg-orange-900/10", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800" },
  medium: { bg: "bg-yellow-50 dark:bg-yellow-900/10", text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-800" },
  low: { bg: "bg-blue-50 dark:bg-blue-900/10", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
};

const SEVERITY_LABEL: Record<RecordWarningSeverity, string> = {
  critical: "긴급", high: "높음", medium: "보통", low: "낮음",
};

const CATEGORY_META: Record<RecordWarningCategory, { label: string; Icon: typeof AlertTriangle }> = {
  record: { label: "기록", Icon: BookOpen },
  course: { label: "이수", Icon: GraduationCap },
  storyline: { label: "스토리라인", Icon: LineChart },
  min_score: { label: "수능최저", Icon: AlertTriangle },
  strategy: { label: "전략", Icon: Target },
  quality: { label: "품질", Icon: AlertTriangle },
  roadmap: { label: "로드맵", Icon: Target },
  forbidden: { label: "금칙어", Icon: AlertTriangle },
};

export function RecordWarningPanel({ warnings, warningDiff }: Props) {
  const [showResolved, setShowResolved] = useState(false);

  if (warnings.length === 0 && (!warningDiff || warningDiff.resolvedWarnings.length === 0)) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-800 dark:bg-green-900/10">
        <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
        <span className="text-sm text-green-700 dark:text-green-400">경고 없음 — 모든 항목이 양호합니다.</span>
      </div>
    );
  }

  // 카테고리별 그룹핑
  const groups = new Map<RecordWarningCategory, RecordWarning[]>();
  for (const w of warnings) {
    const list = groups.get(w.category) ?? [];
    list.push(w);
    groups.set(w.category, list);
  }

  // 심각도 순 정렬
  const severityOrder: RecordWarningSeverity[] = ["critical", "high", "medium", "low"];
  const sortedCategories: RecordWarningCategory[] = ["record", "course", "storyline", "min_score", "strategy", "quality", "roadmap", "forbidden"];

  const criticalCount = warnings.filter((w) => w.severity === "critical").length;
  const highCount = warnings.filter((w) => w.severity === "high").length;

  // E2: diff 통계
  const newCount = warningDiff?.newRuleIds.size ?? 0;
  const resolvedCount = warningDiff?.resolvedWarnings.length ?? 0;
  const hasDiff = warningDiff && (newCount > 0 || resolvedCount > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          총 {warnings.length}건
        </span>
        {criticalCount > 0 && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
            긴급 {criticalCount}
          </span>
        )}
        {highCount > 0 && (
          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
            높음 {highCount}
          </span>
        )}
        {/* E2: 변화 요약 */}
        {hasDiff && (
          <span className="text-[10px] text-[var(--text-tertiary)]">
            이전 대비:
            {newCount > 0 && <span className="ml-1 text-amber-600 dark:text-amber-400">+{newCount} 신규</span>}
            {resolvedCount > 0 && <span className="ml-1 text-emerald-600 dark:text-emerald-400">-{resolvedCount} 해결</span>}
          </span>
        )}
      </div>

      {/* 카테고리별 경고 */}
      {sortedCategories.map((cat) => {
        const items = groups.get(cat);
        if (!items || items.length === 0) return null;
        const meta = CATEGORY_META[cat];
        const sorted = [...items].sort(
          (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
        );

        return (
          <div key={cat}>
            <div className="mb-2 flex items-center gap-1.5">
              <meta.Icon size={14} className="shrink-0 text-[var(--text-tertiary)]" />
              <span className="text-xs font-semibold text-[var(--text-secondary)]">{meta.label}</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">{items.length}건</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {sorted.map((w, i) => {
                const style = SEVERITY_STYLE[w.severity];
                const targetSection = RULE_SECTION_MAP[w.ruleId];
                const changeStatus = getWarningChangeStatus(w.ruleId, warningDiff ?? null);
                return (
                  <div key={i} className={cn("rounded-md border px-3 py-2", style.bg, style.border)}>
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", style.text)}>
                        {SEVERITY_LABEL[w.severity]}
                      </span>
                      {/* E2: 신규 배지 */}
                      {changeStatus === "new" && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          신규
                        </span>
                      )}
                      <span className="text-xs font-medium text-[var(--text-primary)]">{w.title}</span>
                      {targetSection && (
                        <button
                          onClick={() => document.getElementById(targetSection)?.scrollIntoView({ behavior: "smooth" })}
                          className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                        >
                          이동 <ExternalLink size={9} />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{w.message}</p>
                    {w.suggestion && (
                      <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">→ {w.suggestion}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* E2: 해결된 경고 섹션 */}
      {resolvedCount > 0 && warningDiff && (
        <div>
          <button
            onClick={() => setShowResolved((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            <CheckCircle size={14} />
            해결됨 {resolvedCount}건
            <ChevronDown size={12} className={cn("transition-transform", showResolved && "rotate-180")} />
          </button>
          {showResolved && (
            <div className="mt-2 flex flex-col gap-1">
              {warningDiff.resolvedWarnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 dark:border-emerald-800 dark:bg-emerald-900/10">
                  <CheckCircle size={12} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
                  <span className="text-xs text-emerald-700 line-through dark:text-emerald-400">
                    {WARNING_LABELS[w.ruleId] ?? w.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
