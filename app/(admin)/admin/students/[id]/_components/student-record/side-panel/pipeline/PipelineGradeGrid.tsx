"use client";

// ============================================
// Grade Pipeline 그리드 컴포넌트
// ============================================

import React from "react";
import { Play, RefreshCw, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  GRADE_PHASE_GROUPS,
  GRADE_PHASE_GROUP_SECTIONS,
  PRE_TASK_PHASE_GROUPS,
  type CellStatus,
  isGradePhaseReady,
  isGradePreTaskReady,
  deriveCellStatus,
} from "./pipeline-constants";
import { CockpitCell } from "./PipelineCockpitCell";
import type { GradeAwarePipelineStatus } from "@/lib/domains/student-record/actions/pipeline-orchestrator-types";

interface PipelineGradeGridProps {
  displayGrades: number[];
  gp: GradeAwarePipelineStatus["gradePipelines"];
  expectedModes: Record<number, "analysis" | "design">;
  runningCell: string | null;
  runningStartMs: number | null;
  onRunGradePhase: (grade: number, phase: number) => void;
  onRunGradeSequence?: (grade: number) => void;
  /** M1-c W3 (2026-04-27): 학년별 재실행 (cascade tier 만 reset, P1~P3 캐시 보존). */
  onRerunGrade?: (grade: number) => void;
  /** 학년 단위 실행 버튼 disabled 여부 (전체 실행 중 등) */
  isGradeRunDisabled?: boolean;
  /** 권고1 (2026-04-28): P4 setek_guide 부분 생성 감지 시 누락 과목만 재생성 */
  onRecoverSetekGuides?: (grade: number) => void;
  /** recover 진행 중인 학년 (1/2/3) — 버튼 disabled */
  recoveringGrade?: number | null;
  /** Phase 3.5 pre-task 4종 재실행 (학년 단위, phase-4-pre route 호출) */
  onRunGradePreTask?: (grade: number) => void;
}

export function PipelineGradeGrid({
  displayGrades,
  gp,
  expectedModes,
  runningCell,
  runningStartMs,
  onRunGradePhase,
  onRunGradeSequence,
  onRerunGrade,
  isGradeRunDisabled,
  onRecoverSetekGuides,
  recoveringGrade,
  onRunGradePreTask,
}: PipelineGradeGridProps) {
  return (
    <div>
      <h4 className="text-2xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
        Grade Pipeline
      </h4>
      <div className="space-y-3">
        {GRADE_PHASE_GROUP_SECTIONS.map((section) => {
          // "역량 분석" 섹션 렌더링 직후 Phase 3.5 사전 분석 블록 삽입
          const showPreTaskSectionAfter = section.title === "역량 분석";
          const colCount = section.phases.length;
          const gridColsClass =
            colCount === 3
              ? "grid-cols-[56px_repeat(3,1fr)]"
              : "grid-cols-[56px_repeat(2,1fr)]";

          return (
            <React.Fragment key={section.title}>
            <div>
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
                    "text-2xs font-semibold",
                    section.designOnly
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-indigo-700 dark:text-indigo-300",
                  )}
                >
                  {section.title}
                </span>
                <span
                  className={cn(
                    "text-3xs",
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
                    className="text-center text-2xs font-semibold text-[var(--text-tertiary)] pb-0.5"
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
                              "text-3xs font-medium px-1 py-px rounded-sm",
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
                              "inline-flex items-center gap-0.5 rounded-sm border px-1 py-px text-3xs font-medium transition-colors",
                              canRunGradeSequence
                                ? "border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30 cursor-pointer"
                                : "border-border text-text-disabled dark:border-border dark:text-text-secondary cursor-not-allowed",
                            )}
                          >
                            <Play className="h-2.5 w-2.5" />
                            전체
                          </button>
                        )}
                        {/* M1-c W3 (2026-04-27): 학년별 재실행 — completed 학년에서 cascade tier 만 reset */}
                        {isFirstSection &&
                          onRerunGrade &&
                          pipeline?.status === "completed" &&
                          !isGradeRunDisabled && (
                            <button
                              type="button"
                              onClick={() => onRerunGrade(grade)}
                              title={`${grade}학년 cascade tier 재실행 (P3.6+P4-P9, P1-P3 캐시 보존)`}
                              className="inline-flex items-center gap-0.5 rounded-sm border border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30 px-1 py-px text-3xs font-medium transition-colors cursor-pointer"
                            >
                              <RefreshCw className="h-2.5 w-2.5" />
                              재실행
                            </button>
                          )}
                        {/* 권고1 (2026-04-28): P4 setek_guide 부분 생성 감지 시 누락 과목만 재생성 */}
                        {isFirstSection &&
                          onRecoverSetekGuides &&
                          pipeline?.errors?.setek_guide?.includes("부분 생성") && (
                            <button
                              type="button"
                              onClick={() => onRecoverSetekGuides(grade)}
                              disabled={recoveringGrade === grade}
                              title={`${grade}학년 누락 과목 재생성 — ${pipeline.errors.setek_guide}`}
                              className={cn(
                                "inline-flex items-center gap-0.5 rounded-sm border px-1 py-px text-3xs font-medium transition-colors",
                                recoveringGrade === grade
                                  ? "border-border text-text-disabled dark:border-border dark:text-text-secondary cursor-not-allowed"
                                  : "border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer",
                              )}
                            >
                              <Wrench className="h-2.5 w-2.5" />
                              {recoveringGrade === grade ? "재생성중" : "누락보충"}
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

            {/* Phase 3.5 사전 분석 — "역량 분석" 섹션 직후 삽입 */}
            {showPreTaskSectionAfter && (
              <div>
                {/* 섹션 헤더 */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-t-md mb-1 bg-violet-50 dark:bg-violet-950/20">
                  <span className="text-2xs font-semibold text-violet-700 dark:text-violet-300">
                    사전 분석
                  </span>
                  <span className="text-3xs text-violet-400 dark:text-violet-500">
                    Phase 3.5 · pre-task
                  </span>
                </div>

                {/* 4열 그리드 */}
                <div className="grid gap-1 grid-cols-[56px_repeat(4,1fr)]">
                  {/* 헤더 행 */}
                  <div />
                  {PRE_TASK_PHASE_GROUPS.map((ptg) => (
                    <div
                      key={ptg.key}
                      className="text-center text-2xs font-semibold text-[var(--text-tertiary)] pb-0.5"
                    >
                      {ptg.label}
                    </div>
                  ))}

                  {/* 1~3학년 행 */}
                  {displayGrades.map((grade) => {
                    const pipeline = gp[grade];
                    const tasks = pipeline?.tasks ?? {};
                    const previews = pipeline?.previews ?? {};
                    const elapsed = pipeline?.elapsed ?? {};

                    return (
                      <div key={grade} className="contents">
                        {/* 학년 라벨 (pre-task 섹션은 버튼 없이 라벨만) */}
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-xs font-bold text-[var(--text-tertiary)]">
                            {grade}학년
                          </span>
                          {onRunGradePreTask && !isGradeRunDisabled && (
                            <button
                              type="button"
                              onClick={() => onRunGradePreTask(grade)}
                              title={`${grade}학년 사전 분석 재실행 (phase-4-pre)`}
                              className="inline-flex items-center gap-0.5 rounded-sm border border-violet-200 text-violet-600 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/30 px-1 py-px text-3xs font-medium transition-colors cursor-pointer mt-0.5"
                            >
                              <Play className="h-2.5 w-2.5" />
                              재실행
                            </button>
                          )}
                        </div>

                        {PRE_TASK_PHASE_GROUPS.map((ptg) => {
                          const taskStatus = tasks[ptg.key] ?? "pending";
                          const prereqMet = isGradePreTaskReady(grade, ptg.key, gp);
                          const isCached = previews[ptg.key]?.includes("캐시") ?? false;
                          const isSkipped = previews[ptg.key]?.includes("스킵") ?? false;
                          const cellKey = `g-${grade}-pre-${ptg.key}`;
                          const status =
                            runningCell === cellKey
                              ? ("running" as CellStatus)
                              : deriveCellStatus(
                                  [taskStatus],
                                  prereqMet,
                                  isCached,
                                  isSkipped,
                                  pipeline?.status,
                                );

                          const elapsedVal = elapsed[ptg.key];
                          const errors = pipeline?.errors ?? {};
                          const errorMsg =
                            status === "failed" ? errors[ptg.key] : undefined;
                          const runningPreview =
                            status === "running" ? previews[ptg.key] : undefined;

                          return (
                            <CockpitCell
                              key={ptg.key}
                              label={ptg.label}
                              status={status}
                              elapsedMs={elapsedVal}
                              progressText={runningPreview}
                              runningStartMs={
                                runningCell === cellKey
                                  ? (runningStartMs ?? undefined)
                                  : undefined
                              }
                              tooltip={errorMsg}
                              onClick={() => onRunGradePreTask?.(grade)}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
