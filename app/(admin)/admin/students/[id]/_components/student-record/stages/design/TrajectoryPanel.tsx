"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { studentTopicTrajectoriesQueryOptions } from "@/lib/query-options/explorationGuide";
import { normalizeConfidence } from "@/lib/domains/guide/confidence";

const DIFF_COLORS: Record<string, string> = {
  basic: "bg-green-500",
  intermediate: "bg-yellow-500",
  advanced: "bg-red-500",
};

const DIFF_LABELS: Record<string, string> = {
  basic: "기초",
  intermediate: "발전",
  advanced: "심화",
};

const SOURCE_LABELS: Record<string, string> = {
  auto_from_assignment: "배정",
  auto_from_pipeline: "파이프라인",
  extracted_from_neis: "NEIS 추출",
  seed_from_major: "전공 시드",
  consultant_manual: "수동",
};

const SOURCE_COLORS: Record<string, string> = {
  extracted_from_neis: "text-violet-500 dark:text-violet-400",
  auto_from_assignment: "text-primary-500 dark:text-primary-400",
  auto_from_pipeline: "text-primary-500 dark:text-primary-400",
  consultant_manual: "text-amber-500 dark:text-amber-400",
};

interface TrajectoryRow {
  id: string;
  grade: number;
  topic_cluster_id: string;
  source: string;
  confidence: number;
  evidence: {
    guide_id?: string;
    difficulty_level?: string;
    title?: string;
    assigned_at?: string;
    source_record_ids?: string[];
    extraction_reasoning?: string;
  } | null;
  cluster: { name: string } | null;
}

export function TrajectoryPanel({ studentId }: { studentId: string }) {
  const { data: trajectories } = useQuery(studentTopicTrajectoriesQueryOptions(studentId));
  const rows = (trajectories ?? []) as TrajectoryRow[];

  if (rows.length === 0) return null;

  // 학년별 그룹핑
  const byGrade = new Map<number, TrajectoryRow[]>();
  for (const r of rows) {
    const list = byGrade.get(r.grade) ?? [];
    list.push(r);
    byGrade.set(r.grade, list);
  }

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          탐구 궤적
        </h3>
        <span className="text-xs text-[var(--text-secondary)]">
          {rows.length}개 클러스터 탐구
        </span>
      </div>

      <div className="space-y-3">
        {[...byGrade.entries()]
          .sort(([a], [b]) => a - b)
          .map(([grade, items]) => (
            <div key={grade}>
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
                {grade}학년
              </p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => {
                  const diff = item.evidence?.difficulty_level ?? "basic";
                  const sourceLabel =
                    SOURCE_LABELS[item.source] ?? item.source;
                  const sourceColor =
                    SOURCE_COLORS[item.source] ?? "text-[var(--text-secondary)]";
                  // 보정 confidence → opacity
                  const normConf = normalizeConfidence(item.confidence, item.source);
                  const opacity =
                    normConf >= 0.7
                      ? "opacity-100"
                      : normConf >= 0.5
                        ? "opacity-80"
                        : "opacity-60";

                  return (
                    <span
                      key={item.id}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs",
                        "bg-secondary-50 dark:bg-secondary-800 text-[var(--text-primary)]",
                        opacity,
                      )}
                      title={`${item.evidence?.title ?? ""} (${sourceLabel}, 신뢰도 ${Math.round(normConf * 100)}%)`}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          DIFF_COLORS[diff] ?? "bg-secondary-400",
                        )}
                      />
                      <span className="truncate max-w-[100px]">
                        {item.cluster?.name ?? "알 수 없음"}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {DIFF_LABELS[diff] ?? diff}
                      </span>
                      <span className={cn("text-[9px]", sourceColor)}>
                        {sourceLabel}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
