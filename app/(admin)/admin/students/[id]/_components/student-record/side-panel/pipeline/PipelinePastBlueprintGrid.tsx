"use client";

// ============================================
// Past Analytics + Blueprint 그리드 (4축×3층 A/B층)
// 1개 섹션 · 2개 행: Past Analytics (3 phase) / Blueprint (1 phase)
// ============================================

import { cn } from "@/lib/cn";
import {
  PAST_ANALYTICS_PHASE_GROUPS,
  BLUEPRINT_PHASE_GROUPS,
  type CellStatus,
  isPastAnalyticsPhaseReady,
  isBlueprintPhaseReady,
  deriveCellStatus,
} from "./pipeline-constants";
import { CockpitCell } from "./PipelineCockpitCell";
import type { GradeAwarePipelineStatus } from "@/lib/domains/student-record/actions/pipeline-orchestrator-types";

interface PipelinePastBlueprintGridProps {
  pa: GradeAwarePipelineStatus["pastAnalyticsPipeline"];
  bp: GradeAwarePipelineStatus["blueprintPipeline"];
  expectedModes: Record<number, "analysis" | "design">;
  runningCell: string | null;
  runningStartMs: number | null;
  onRunPastPhase: (phase: number) => void;
  onRunBlueprintPhase: () => void;
}

export function PipelinePastBlueprintGrid({
  pa,
  bp,
  expectedModes,
  runningCell,
  runningStartMs,
  onRunPastPhase,
  onRunBlueprintPhase,
}: PipelinePastBlueprintGridProps) {
  // 축 노출 규칙: Past는 분석 대상 학년(k≥1), Blueprint는 설계 대상 학년(k<3) 존재 시만.
  const modes = Object.values(expectedModes);
  const showPast = modes.includes("analysis") || pa != null;
  const showBlueprint = modes.includes("design") || bp != null;

  if (!showPast && !showBlueprint) return null;

  return (
    <div>
      <h4 className="text-2xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
        Past / Blueprint Pipeline
      </h4>

      <div className="space-y-3">
        {/* ── Row 1: Past Analytics (A층) ───────────────────────────────── */}
        {showPast && (
          <div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-t-md mb-1 bg-blue-50 dark:bg-blue-950/20">
              <span className="text-2xs font-semibold text-blue-700 dark:text-blue-300">
                A층 · 과거 분석
              </span>
              <span className="text-3xs text-blue-400 dark:text-blue-500">
                NEIS 기록 기반 (k≥1)
              </span>
            </div>

            <div className="grid grid-cols-[56px_repeat(3,1fr)] gap-1">
              {/* 헤더 행 */}
              <div />
              {PAST_ANALYTICS_PHASE_GROUPS.map((pg) => (
                <div
                  key={pg.label}
                  className="text-center text-2xs font-semibold text-[var(--text-tertiary)] pb-0.5"
                >
                  {pg.label}
                </div>
              ))}

              {/* Past 행 */}
              <div className="flex flex-col items-center justify-center gap-0.5">
                <span
                  className={cn(
                    "text-xs font-bold",
                    pa?.status === "completed"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : pa?.status === "running"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-[var(--text-tertiary)]",
                  )}
                >
                  과거
                </span>
                <span className="text-3xs font-medium px-1 py-px rounded-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  A층
                </span>
              </div>
              {PAST_ANALYTICS_PHASE_GROUPS.map((pg, idx) => {
                const phaseNum = idx + 1;
                const tasks = pa?.tasks ?? {};
                const previews = pa?.previews ?? {};
                const elapsed = pa?.elapsed ?? {};
                const errors = pa?.errors ?? {};
                const taskStatuses = pg.keys.map((k) => tasks[k] ?? "pending");
                const prereqMet = isPastAnalyticsPhaseReady(phaseNum, pa);
                const isCached = pg.keys.some((k) => previews[k]?.includes("캐시"));
                const isSkipped = pg.keys.some((k) => previews[k]?.includes("스킵"));
                const cellKey = `a-${phaseNum}`;
                const status =
                  runningCell === cellKey
                    ? ("running" as CellStatus)
                    : deriveCellStatus(
                        taskStatuses,
                        prereqMet,
                        isCached,
                        isSkipped,
                        pa?.status,
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
                    onClick={() => onRunPastPhase(phaseNum)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── Row 2: Blueprint (B층) ────────────────────────────────────── */}
        {showBlueprint && (
          <div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-t-md mb-1 bg-amber-50 dark:bg-amber-950/20">
              <span className="text-2xs font-semibold text-amber-700 dark:text-amber-300">
                B층 · 수렴 설계
              </span>
              <span className="text-3xs text-amber-500 dark:text-amber-400">
                진로→3년 Top-Down (k&lt;3)
              </span>
            </div>

            <div className="grid grid-cols-[56px_1fr] gap-1">
              {/* 헤더 행 */}
              <div />
              {BLUEPRINT_PHASE_GROUPS.map((pg) => (
                <div
                  key={pg.label}
                  className="text-center text-2xs font-semibold text-[var(--text-tertiary)] pb-0.5"
                >
                  {pg.label}
                </div>
              ))}

              {/* Blueprint 행 */}
              <div className="flex flex-col items-center justify-center gap-0.5">
                <span
                  className={cn(
                    "text-xs font-bold",
                    bp?.status === "completed"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : bp?.status === "running"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-[var(--text-tertiary)]",
                  )}
                >
                  설계
                </span>
                <span className="text-3xs font-medium px-1 py-px rounded-sm bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  B층
                </span>
              </div>
              {BLUEPRINT_PHASE_GROUPS.map((pg) => {
                const tasks = bp?.tasks ?? {};
                const previews = bp?.previews ?? {};
                const elapsed = bp?.elapsed ?? {};
                const errors = bp?.errors ?? {};
                const taskStatuses = pg.keys.map((k) => tasks[k] ?? "pending");
                const prereqMet = isBlueprintPhaseReady(bp);
                const isCached = pg.keys.some((k) => previews[k]?.includes("캐시"));
                const isSkipped = pg.keys.some((k) => previews[k]?.includes("스킵"));
                const cellKey = `b-1`;
                const status =
                  runningCell === cellKey
                    ? ("running" as CellStatus)
                    : deriveCellStatus(
                        taskStatuses,
                        prereqMet,
                        isCached,
                        isSkipped,
                        bp?.status,
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
                    onClick={onRunBlueprintPhase}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
