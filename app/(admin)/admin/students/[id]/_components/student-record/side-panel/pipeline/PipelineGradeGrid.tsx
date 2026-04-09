"use client";

// ============================================
// Grade Pipeline 그리드 컴포넌트
// ============================================

import { Play } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  GRADE_PHASE_GROUPS,
  GRADE_PHASE_GROUP_SECTIONS,
  type CellStatus,
  isGradePhaseReady,
  deriveCellStatus,
} from "./pipeline-constants";
import { CockpitCell } from "./PipelineCockpitCell";
import type { GradeAwarePipelineStatus } from "@/lib/domains/student-record/actions/pipeline-orchestrator-types";

interface PipelineGradeGridProps {
  displayGrades: number[];
  gp: GradeAwarePipelineStatus["gradePipelines"];
  expectedModes: GradeAwarePipelineStatus["expectedModes"];
  runningCell: string | null;
  runningStartMs: number | null;
  onRunGradePhase: (grade: number, phase: number) => void;
  onRunGradeSequence?: (grade: number) => void;
  /** 학년 단위 실행 버튼 disabled 여부 (전체 실행 중 등) */
  isGradeRunDisabled?: boolean;
}

export function PipelineGradeGrid({
  displayGrades,
  gp,
  expectedModes,
  runningCell,
  runningStartMs,
  onRunGradePhase,
  onRunGradeSequence,
  isGradeRunDisabled,
}: PipelineGradeGridProps) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
        Grade Pipeline
      </h4>
      <div className="space-y-3">
        {GRADE_PHASE_GROUP_SECTIONS.map((section) => {
          const colCount = section.phases.length;
          const gridColsClass =
            colCount === 3
              ? "grid-cols-[56px_repeat(3,1fr)]"
              : "grid-cols-[56px_repeat(2,1fr)]";

          return (
            <div key={section.title}>
              {/* 섹션 헤더 */}
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-t-md mb-1",
                  section.designOnly
                    ? "bg-amber-50 dark:bg-amber-950/20"
                    : "bg-indigo-50 dark:bg-indigo-950/20",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    section.designOnly
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-indigo-700 dark:text-indigo-300",
                  )}
                >
                  {section.title}
                </span>
                <span
                  className={cn(
                    "text-[10px]",
                    section.designOnly
                      ? "text-amber-500 dark:text-amber-400"
                      : "text-indigo-400 dark:text-indigo-500",
                  )}
                >
                  {section.subtitle}
                </span>
              </div>

              {/* 섹션 그리드 */}
              <div className={cn("grid gap-1", gridColsClass)}>
                {/* 헤더 행 */}
                <div />
                {section.phases.map((pg) => (
                  <div
                    key={pg.label}
                    className="text-center text-[11px] font-semibold text-[var(--text-tertiary)] pb-0.5"
                  >
                    {pg.label}
                  </div>
                ))}

                {/* 1~3학년 행 */}
                {displayGrades.map((grade) => {
                  const pipeline = gp[grade];
                  const tasks = pipeline?.tasks ?? {};
                  const previews = pipeline?.previews ?? {};
                  const elapsed = pipeline?.elapsed ?? {};
                  const mode = pipeline?.mode ?? expectedModes[grade];

                  // 학년별 실행 버튼은 첫 섹션(역량 분석)에만 노출해 중복 방지
                  const isFirstSection = section.title === "역량 분석";
                  const canRunGradeSequence =
                    isFirstSection &&
                    !!onRunGradeSequence &&
                    pipeline?.status !== "completed" &&
                    pipeline?.status !== "running" &&
                    !isGradeRunDisabled;

                  return (
                    <div key={grade} className="contents">
                      {/* 학년 라벨 */}
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span
                          className={cn(
                            "text-xs font-bold",
                            pipeline?.status === "completed"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : pipeline?.status === "running"
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-[var(--text-tertiary)]",
                          )}
                        >
                          {grade}학년
                        </span>
                        {mode && (
                          <span
                            className={cn(
                              "text-[9px] font-medium px-1 py-px rounded-sm",
                              mode === "analysis"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                            )}
                          >
                            {mode === "analysis" ? "분석" : "설계"}
                          </span>
                        )}
                        {isFirstSection && onRunGradeSequence && (
                          <button
                            type="button"
                            onClick={() => onRunGradeSequence(grade)}
                            disabled={!canRunGradeSequence}
                            title={
                              pipeline?.status === "completed"
                                ? "이미 완료된 학년입니다"
                                : `${grade}학년 전체 실행`
                            }
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded-sm border px-1 py-px text-[9px] font-medium transition-colors",
                              canRunGradeSequence
                                ? "border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30 cursor-pointer"
                                : "border-gray-200 text-gray-300 dark:border-gray-700 dark:text-gray-600 cursor-not-allowed",
                            )}
                          >
                            <Play className="h-2.5 w-2.5" />
                            전체
                          </button>
                        )}
                      </div>

                      {section.phases.map((pg) => {
                        // 전체 GRADE_PHASE_GROUPS에서의 원래 index로 phaseNum 계산
                        const globalIdx = GRADE_PHASE_GROUPS.findIndex(
                          (g) => g.label === pg.label,
                        );
                        const phaseNum = globalIdx + 1;
                        const taskStatuses = pg.keys.map((k) => tasks[k] ?? "pending");
                        const prereqMet = isGradePhaseReady(grade, phaseNum, gp);
                        const isCached = pg.keys.some((k) => previews[k]?.includes("캐시"));
                        const isSkipped = pg.keys.some((k) => previews[k]?.includes("스킵"));
                        const cellKey = `g-${grade}-${phaseNum}`;
                        const status =
                          runningCell === cellKey
                            ? ("running" as CellStatus)
                            : deriveCellStatus(
                                taskStatuses,
                                prereqMet,
                                isCached,
                                isSkipped,
                                pipeline?.status,
                                {
                                  mode,
                                  isDesignOnlySection: section.designOnly,
                                },
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

                        const errors = pipeline?.errors ?? {};
                        const errorMsg =
                          status === "failed"
                            ? pg.keys.map((k) => errors[k]).filter(Boolean).join("; ") ||
                              undefined
                            : undefined;

                        // 설계 전용 그룹에서 분석 모드 학년 여부
                        const isDesignOnlyCell = section.designOnly && mode === "analysis";

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
                            isDesignOnly={isDesignOnlyCell}
                            onClick={() => onRunGradePhase(grade, phaseNum)}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
