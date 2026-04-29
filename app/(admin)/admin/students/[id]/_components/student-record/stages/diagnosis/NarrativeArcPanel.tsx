"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { narrativeArcsQueryOptions } from "@/lib/query-options/studentRecord";
import { NARRATIVE_STAGES, extractStageFlags } from "../../graph/graph-data-builder";
import type { PersistedNarrativeArc } from "@/lib/domains/student-record/repository/narrative-arc-repository";

interface Props {
  studentId: string;
  tenantId: string;
  recordLabelMap?: Record<string, string>;
}

const RECORD_TYPE_LABEL: Record<string, string> = {
  setek: "세특",
  personal_setek: "개인세특",
  changche: "창체",
  haengteuk: "행특",
};

export function NarrativeArcPanel({ studentId, tenantId, recordLabelMap }: Props) {
  const { data: arcs, isLoading } = useQuery(narrativeArcsQueryOptions(studentId, tenantId));
  const [filter, setFilter] = useState<"all" | "weak" | "strong">("all");

  const filtered = useMemo(() => {
    if (!arcs) return [];
    if (filter === "all") return arcs;
    if (filter === "weak") return arcs.filter((a) => (a.stages_present_count ?? 0) <= 3);
    return arcs.filter((a) => (a.stages_present_count ?? 0) >= 6);
  }, [arcs, filter]);

  const stageFrequency = useMemo(() => {
    if (!arcs || arcs.length === 0) return null;
    const counts = NARRATIVE_STAGES.map((s) => ({
      key: s.key,
      label: s.label,
      index: s.index,
      count: arcs.filter((a) => extractStageFlags(a).stagesPresent[s.key]).length,
    }));
    return { total: arcs.length, counts };
  }, [arcs]);

  if (isLoading) {
    return <p className="text-xs text-[var(--text-tertiary)]">서사 태깅 불러오는 중…</p>;
  }
  if (!arcs || arcs.length === 0) {
    return (
      <p className="text-xs text-[var(--text-tertiary)]">
        저장된 서사 태깅이 없습니다. Synthesis 파이프라인 narrative_arc 단계 실행 시 생성됩니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {stageFrequency && (
        <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
            8단계 출현 빈도 <span className="text-[var(--text-tertiary)]">(전체 {stageFrequency.total}건)</span>
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {stageFrequency.counts.map((s) => {
              const rate = stageFrequency.total > 0 ? s.count / stageFrequency.total : 0;
              const color = rate >= 0.7 ? "bg-emerald-500" : rate >= 0.4 ? "bg-amber-500" : "bg-red-500";
              return (
                <div key={s.key} className="flex flex-col items-center gap-1">
                  <div className="relative h-14 w-4 overflow-hidden rounded-sm border border-[var(--border-primary)] bg-white dark:bg-secondary-900">
                    <div
                      className={cn("absolute bottom-0 left-0 w-full", color)}
                      style={{ height: `${Math.max(4, rate * 100)}%` }}
                    />
                  </div>
                  <span className="text-3xs text-[var(--text-tertiary)]">
                    {s.index}·{s.label}
                  </span>
                  <span className="text-3xs font-medium text-[var(--text-secondary)]">
                    {s.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-3xs text-[var(--text-tertiary)]">필터:</span>
        {([
          { k: "all", l: "전체" },
          { k: "weak", l: "약한 서사(≤3)" },
          { k: "strong", l: "강한 서사(≥6)" },
        ] as const).map((btn) => (
          <button
            key={btn.k}
            type="button"
            onClick={() => setFilter(btn.k)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-3xs",
              filter === btn.k
                ? "border-indigo-500 bg-indigo-500 text-white"
                : "border-[var(--border-primary)] text-[var(--text-secondary)]",
            )}
          >
            {btn.l}
          </button>
        ))}
        <span className="ml-auto text-3xs text-[var(--text-tertiary)]">
          {filtered.length}/{arcs.length}건
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {filtered.map((arc) => (
          <ArcRow
            key={arc.id}
            arc={arc}
            label={recordLabelMap?.[arc.record_id] ?? arc.record_id.slice(0, 8)}
          />
        ))}
      </ul>
    </div>
  );
}

function ArcRow({ arc, label }: { arc: PersistedNarrativeArc; label: string }) {
  const summary = extractStageFlags(arc);
  const count = summary.stagesPresentCount;
  const countColor = count >= 6
    ? "text-emerald-700 dark:text-emerald-400"
    : count <= 3
      ? "text-red-700 dark:text-red-400"
      : "text-amber-700 dark:text-amber-400";
  return (
    <li className="rounded-md border border-[var(--border-primary)] bg-white p-2 dark:bg-secondary-900">
      <div className="flex items-center gap-2">
        <span className="rounded-sm border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-3xs text-[var(--text-tertiary)]">
          {RECORD_TYPE_LABEL[arc.record_type] ?? arc.record_type}
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">{arc.grade}학년</span>
        <span className="truncate text-xs text-[var(--text-primary)]">{label}</span>
        <span className={cn("ml-auto text-xs font-semibold", countColor)}>{count}/8</span>
      </div>
      <div className="mt-1.5 flex gap-0.5">
        {NARRATIVE_STAGES.map((s) => {
          const present = summary.stagesPresent[s.key];
          return (
            <span
              key={s.key}
              title={`${s.index}. ${s.label}`}
              className={cn(
                "h-4 flex-1 rounded-sm border",
                present
                  ? "border-indigo-500 bg-indigo-500"
                  : "border-[var(--border-primary)] bg-transparent",
              )}
            />
          );
        })}
      </div>
    </li>
  );
}
