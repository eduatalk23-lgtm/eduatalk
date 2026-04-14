"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { hyperedgesQueryOptions } from "@/lib/query-options/studentRecord";
import { localizeThemeLabel, localizeCompetencyList } from "../../graph/graph-data-builder";
import type { PersistedHyperedge, HyperedgeMember } from "@/lib/domains/student-record/repository/hyperedge-repository";

interface Props {
  studentId: string;
  tenantId: string;
}

const RECORD_TYPE_LABEL: Record<string, string> = {
  setek: "세특",
  personal_setek: "개인세특",
  changche: "창체",
  haengteuk: "행특",
  reading: "독서",
};

const CONTEXT_LABEL: Record<string, string> = {
  analysis: "분석",
  synthesis_inferred: "추론",
  projected: "설계",
};

export function HyperedgeListPanel({ studentId, tenantId }: Props) {
  const { data: hyperedges, isLoading } = useQuery(hyperedgesQueryOptions(studentId, tenantId));

  if (isLoading) {
    return <p className="text-xs text-[var(--text-tertiary)]">하이퍼엣지 불러오는 중…</p>;
  }
  if (!hyperedges || hyperedges.length === 0) {
    return (
      <p className="text-xs text-[var(--text-tertiary)]">
        저장된 하이퍼엣지가 없습니다. Synthesis Phase 2 hyperedge_computation 실행 시 생성됩니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] text-[var(--text-tertiary)]">
        총 {hyperedges.length}건 · 여러 레코드가 공통 주제로 수렴하는 N-ary 연결을 보여줍니다.
      </p>
      <ul className="flex flex-col gap-2">
        {hyperedges.map((h) => (
          <HyperedgeRow key={h.id} edge={h} />
        ))}
      </ul>
    </div>
  );
}

function HyperedgeRow({ edge }: { edge: PersistedHyperedge }) {
  const confidencePct = Math.round(edge.confidence * 100);
  const confColor = confidencePct >= 75
    ? "text-emerald-700 dark:text-emerald-400"
    : confidencePct >= 50
      ? "text-amber-700 dark:text-amber-400"
      : "text-[var(--text-tertiary)]";

  return (
    <li className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3">
      <div className="flex flex-wrap items-baseline gap-2 border-b border-[var(--border-primary)] pb-2">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {localizeThemeLabel(edge.theme_label)}
        </span>
        <span className="rounded-sm border border-[var(--border-primary)] bg-white px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)] dark:bg-secondary-900">
          {CONTEXT_LABEL[edge.edge_context] ?? edge.edge_context}
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          멤버 {edge.member_count}
        </span>
        <span className={cn("ml-auto text-xs font-medium", confColor)}>
          신뢰도 {confidencePct}%
        </span>
      </div>

      <ul className="mt-2 flex flex-col gap-1">
        {edge.members.map((m: HyperedgeMember, idx: number) => (
          <li
            key={`${m.recordType}-${m.recordId}-${idx}`}
            className="flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--border-primary)] bg-white px-2 py-1 text-xs dark:bg-secondary-900"
          >
            <span className="rounded-sm border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
              {RECORD_TYPE_LABEL[m.recordType] ?? m.recordType}
            </span>
            {m.grade != null && (
              <span className="text-[10px] text-[var(--text-tertiary)]">{m.grade}학년</span>
            )}
            <span className="truncate text-[var(--text-primary)]">{m.label}</span>
            {m.role && (
              <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">{m.role}</span>
            )}
          </li>
        ))}
      </ul>

      {(edge.shared_competencies?.length || edge.shared_keywords?.length) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {edge.shared_competencies && edge.shared_competencies.length > 0 && (
            <>
              {localizeCompetencyList(edge.shared_competencies).map((c) => (
                <span
                  key={`comp-${c}`}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300"
                >
                  {c}
                </span>
              ))}
            </>
          )}
          {edge.shared_keywords && edge.shared_keywords.length > 0 && (
            <>
              {edge.shared_keywords.map((k) => (
                <span
                  key={`kw-${k}`}
                  className="rounded-full border border-[var(--border-primary)] bg-white px-2 py-0.5 text-[10px] text-[var(--text-secondary)] dark:bg-secondary-900"
                >
                  #{k}
                </span>
              ))}
            </>
          )}
        </div>
      )}

      {edge.evidence && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          {edge.evidence}
        </p>
      )}
    </li>
  );
}
