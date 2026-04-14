"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { hyperedgesQueryOptions } from "@/lib/query-options/studentRecord";
import type { PersistedHyperedge, HyperedgeMember } from "@/lib/domains/student-record/repository/hyperedge-repository";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  localizeThemeLabel,
  localizeCompetencyList,
} from "../graph/graph-data-builder";

/**
 * Phase 1 Layer 2: 통합 테마 (hyperedge) 리스트 카드.
 * 3+ 레코드가 하나의 주제로 수렴하는 하이퍼엣지를 간단한 리스트로 표시.
 * atomic 검증(컨설턴트): 각 hyperedge의 멤버·공유역량·confidence 판정.
 * holistic 그래프 뷰는 Phase 1.x로 분리.
 */
export function ThemeConvergencePanel({
  studentId,
  tenantId,
}: {
  studentId: string;
  tenantId: string;
}) {
  const { data, isLoading } = useQuery(hyperedgesQueryOptions(studentId, tenantId));

  const hyperedges = useMemo<PersistedHyperedge[]>(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.confidence - a.confidence);
  }, [data]);

  if (isLoading) {
    return (
      <div className="px-4 py-3 text-xs text-[var(--text-tertiary)]">통합 테마 불러오는 중…</div>
    );
  }

  if (hyperedges.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-4 pb-3 pt-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          통합 테마 {hyperedges.length}건
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)]">3+ 레코드 수렴</span>
      </div>
      <div className="flex flex-col gap-2">
        {hyperedges.map((h) => (
          <HyperedgeCard key={h.id} hyperedge={h} />
        ))}
      </div>
    </div>
  );
}

function HyperedgeCard({ hyperedge }: { hyperedge: PersistedHyperedge }) {
  const isInferred = hyperedge.edge_context === "synthesis_inferred";
  const confPct = Math.round(hyperedge.confidence * 100);

  return (
    <div
      className={cn(
        "rounded-md border p-2.5",
        isInferred
          ? "border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20"
          : "border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 text-xs font-semibold text-[var(--text-primary)]">
          {localizeThemeLabel(hyperedge.theme_label)}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {isInferred && (
            <span className="rounded-sm bg-violet-500 px-1 text-[10px] font-bold text-white">추론</span>
          )}
          <span
            className={cn(
              "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold",
              confPct >= 85
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : confPct >= 70
                  ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
            )}
          >
            conf {confPct}
          </span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
        {hyperedge.member_count}개 레코드
        {hyperedge.shared_competencies && hyperedge.shared_competencies.length > 0
          ? ` · 공유역량 ${localizeCompetencyList(hyperedge.shared_competencies).join("/")}`
          : ""}
      </p>

      <ul className="mt-1.5 flex flex-col gap-0.5">
        {(hyperedge.members as HyperedgeMember[]).map((m, i) => (
          <li
            key={`${m.recordType}:${m.recordId}:${i}`}
            className="truncate text-[11px] text-[var(--text-secondary)]"
          >
            <span className="mr-1 opacity-60">•</span>
            {m.grade ? `${m.grade}학년 · ` : ""}
            {m.label}
          </li>
        ))}
      </ul>

      {hyperedge.evidence && (
        <p className="mt-1.5 border-t border-dashed border-[var(--border-subtle)] pt-1.5 text-[10px] italic text-[var(--text-tertiary)]">
          {hyperedge.evidence}
        </p>
      )}
    </div>
  );
}
