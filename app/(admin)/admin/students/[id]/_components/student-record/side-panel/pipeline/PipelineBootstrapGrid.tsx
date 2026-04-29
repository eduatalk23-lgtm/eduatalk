"use client";

// ============================================
// Bootstrap 그리드 (Auto-Bootstrap Phase 0)
// 3 task (BT0/BT1/BT2) 단일 HTTP phase 로 순차 실행.
// 모든 셀 클릭이 동일 /api/admin/pipeline/bootstrap/phase-1 호출.
// ============================================

import { cn } from "@/lib/cn";
import {
  BOOTSTRAP_PHASE_GROUPS,
  type CellStatus,
  deriveCellStatus,
} from "./pipeline-constants";
import { CockpitCell } from "./PipelineCockpitCell";
import type { GradeAwarePipelineStatus } from "@/lib/domains/student-record/actions/pipeline-orchestrator-types";

interface PipelineBootstrapGridProps {
  boot: GradeAwarePipelineStatus["bootstrapPipeline"];
  runningCell: string | null;
  runningStartMs: number | null;
  onRunBootstrapPhase: () => void;
}

export function PipelineBootstrapGrid({
  boot,
  runningCell,
  runningStartMs,
  onRunBootstrapPhase,
}: PipelineBootstrapGridProps) {
  return (
    <div>
      <h4 className="text-2xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
        Bootstrap Pipeline
      </h4>

      <div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-t-md mb-1 bg-emerald-50 dark:bg-emerald-950/20">
          <span className="text-2xs font-semibold text-emerald-700 dark:text-emerald-300">
            Phase 0 · 자동 셋업
          </span>
          <span className="text-3xs text-emerald-500 dark:text-emerald-400">
            target_major → 메인 탐구 + 수강 계획
          </span>
        </div>

        <div className="grid grid-cols-[56px_repeat(3,1fr)] gap-1">
          {/* 헤더 행 */}
          <div />
          {BOOTSTRAP_PHASE_GROUPS.map((pg) => (
            <div
              key={pg.label}
              className="text-center text-2xs font-semibold text-[var(--text-tertiary)] pb-0.5"
            >
              {pg.label}
            </div>
          ))}

          {/* Bootstrap 행 */}
          <div className="flex flex-col items-center justify-center gap-0.5">
            <span
              className={cn(
                "text-xs font-bold",
                boot?.status === "completed"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : boot?.status === "running"
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-[var(--text-tertiary)]",
              )}
            >
              자동
            </span>
            <span className="text-3xs font-medium px-1 py-px rounded-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              P0
            </span>
          </div>
          {BOOTSTRAP_PHASE_GROUPS.map((pg, idx) => {
            const phaseNum = idx + 1;
            const tasks = boot?.tasks ?? {};
            const previews = boot?.previews ?? {};
            const elapsed = boot?.elapsed ?? {};
            const errors = boot?.errors ?? {};
            const taskStatuses = pg.keys.map((k) => tasks[k] ?? "pending");
            // 3 task 모두 단일 phase-1 route 로 순차 실행되므로 prereq 는 항상 true.
            const prereqMet = true;
            const isCached = pg.keys.some((k) => previews[k]?.includes("캐시"));
            const isSkipped = pg.keys.some((k) => previews[k]?.includes("skip"));
            const cellKey = `boot-${phaseNum}`;
            const status =
              runningCell === cellKey
                ? ("running" as CellStatus)
                : deriveCellStatus(
                    taskStatuses,
                    prereqMet,
                    isCached,
                    isSkipped,
                    boot?.status,
                  );
            const elapsedValues = pg.keys
              .map((k) => elapsed[k])
              .filter((v): v is number => v != null);
            const maxElapsed =
              elapsedValues.length > 0 ? Math.max(...elapsedValues) : undefined;
            const runningPreview =
              status === "running"
                ? pg.keys.map((k) => previews[k]).filter(Boolean).join(" / ") ||
                  undefined
                : undefined;
            const errorMsg =
              status === "failed"
                ? pg.keys.map((k) => errors[k]).filter(Boolean).join("; ") ||
                  undefined
                : undefined;

            return (
              <CockpitCell
                key={pg.label}
                label={pg.label}
                status={status}
                elapsedMs={maxElapsed}
                progressText={runningPreview}
                runningStartMs={
                  runningCell === cellKey
                    ? (runningStartMs ?? undefined)
                    : undefined
                }
                tooltip={errorMsg}
                onClick={onRunBootstrapPhase}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
