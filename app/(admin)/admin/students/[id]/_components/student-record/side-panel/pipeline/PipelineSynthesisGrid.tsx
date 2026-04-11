"use client";

// ============================================
// Synthesis Pipeline 그리드 컴포넌트
// ============================================

import { cn } from "@/lib/cn";
import {
  SYNTHESIS_PHASE_GROUPS,
  STATUS_STYLES,
  type CellStatus,
  isSynthesisPhaseReady,
  deriveCellStatus,
  formatElapsed,
} from "./pipeline-constants";
import { CockpitCell } from "./PipelineCockpitCell";
import type { GradeAwarePipelineStatus } from "@/lib/domains/student-record/actions/pipeline-orchestrator-types";
import { Check, Loader2, ChevronRight, AlertTriangle } from "lucide-react";
import { useState } from "react";

interface PipelineSynthesisGridProps {
  sp: GradeAwarePipelineStatus["synthesisPipeline"];
  gp: GradeAwarePipelineStatus["gradePipelines"];
  expectedModes: GradeAwarePipelineStatus["expectedModes"];
  allGradesCompleted: boolean;
  runningCell: string | null;
  runningStartMs: number | null;
  onRunSynthesisPhase: (phase: number) => void;
}

export function PipelineSynthesisGrid({
  sp,
  gp,
  expectedModes,
  allGradesCompleted,
  runningCell,
  runningStartMs,
  onRunSynthesisPhase,
}: PipelineSynthesisGridProps) {
  // 파이프라인 mode 우선, 없으면 expectedModes 폴백
  const modes =
    Object.keys(expectedModes).length > 0
      ? Object.values(expectedModes)
      : Object.values(gp).map((p) => p.mode);
  const hasAnalysis = modes.includes("analysis");
  const hasDesign = modes.includes("design");

  return (
    <div>
      <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
        Synthesis Pipeline
      </h4>
      <div className="grid grid-cols-[56px_repeat(6,1fr)] gap-1">
        {/* 라벨 셀 */}
        <div className="flex flex-col items-center justify-center gap-0.5">
          <span
            className={cn(
              "text-xs font-bold",
              sp?.status === "completed"
                ? "text-emerald-600 dark:text-emerald-400"
                : sp?.status === "running"
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-[var(--text-tertiary)]",
            )}
          >
            종합
          </span>
          {hasAnalysis && hasDesign && (
            <span className="text-[9px] font-medium px-1 py-px rounded-sm bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              혼합
            </span>
          )}
        </div>

        {/* Phase 셀들 */}
        {SYNTHESIS_PHASE_GROUPS.map((pg, idx) => {
          const phaseNum = idx + 1;
          const synthTasks = sp?.tasks ?? {};
          const taskStatuses = pg.keys.map((k) => synthTasks[k] ?? "pending");
          const prereqMet = isSynthesisPhaseReady(phaseNum, allGradesCompleted, sp);
          const synthPreviews = sp?.previews ?? {};
          const isCached = pg.keys.some((k) => synthPreviews[k]?.includes("캐시"));
          const cellKey = `s-${phaseNum}`;
          const status =
            runningCell === cellKey
              ? ("running" as CellStatus)
              : deriveCellStatus(
                  taskStatuses,
                  prereqMet,
                  isCached,
                  undefined,
                  sp?.status,
                );

          const elapsedValues = pg.keys
            .map((k) => sp?.elapsed?.[k])
            .filter((v): v is number => v != null);
          const maxElapsed =
            elapsedValues.length > 0 ? Math.max(...elapsedValues) : undefined;

          const synthErrors = sp?.errors ?? {};
          const errorMsg =
            status === "failed"
              ? pg.keys.map((k) => synthErrors[k]).filter(Boolean).join("; ") || undefined
              : undefined;

          return (
            <CockpitCell
              key={pg.label}
              label={pg.label}
              status={status}
              elapsedMs={maxElapsed}
              runningStartMs={
                runningCell === cellKey ? (runningStartMs ?? undefined) : undefined
              }
              tooltip={errorMsg}
              onClick={() => onRunSynthesisPhase(phaseNum)}
            />
          );
        })}
      </div>

      {/* H4: 미배정(orphan) 가이드 피드백 */}
      <OrphanGuideFeedback previews={sp?.previews ?? {}} />

      {/* 상태 범례 */}
      <div className="pt-1 border-t border-[var(--border-secondary)] mt-3">
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
          {(
            ["completed", "cached", "running", "ready", "locked", "failed"] as const
          ).map((s) => {
            const style = STATUS_STYLES[s];
            const label = {
              completed: "완료",
              cached: "캐시",
              running: "실행 중",
              ready: "실행 가능",
              locked: "대기",
              failed: "실패",
            }[s];
            return (
              <span
                key={s}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]"
              >
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full border",
                    style.bg,
                    style.border,
                  )}
                />
                {label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── H4: 미배정 가이드 피드백 ─────────────────────────────────────────────────

function OrphanGuideFeedback({ previews }: { previews: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const raw = previews["guide_matching_orphans"];
  if (!raw) return null;

  let orphans: { count: number; guides: Array<{ id: string; title: string }> };
  try {
    orphans = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!orphans.guides || orphans.guides.length === 0) return null;

  return (
    <div className="rounded border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        미배정 가이드 {orphans.count}건 (과목 풀 불일치)
        <ChevronRight className={cn("h-3 w-3 ml-auto transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="flex flex-col gap-1 pt-1.5">
          {orphans.guides.map((g) => (
            <a
              key={g.id}
              href={`/admin/guides/${g.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[10px] text-amber-600 underline decoration-amber-300 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
            >
              {g.title}
            </a>
          ))}
          {orphans.count > orphans.guides.length && (
            <span className="text-[10px] text-[var(--text-tertiary)]">외 {orphans.count - orphans.guides.length}건</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 태스크 로그 패널 ────────────────────────────────────────────────────────

interface TaskLogEntry {
  label: string;
  preview: string;
  elapsedMs?: number;
}

interface PipelineLogPanelProps {
  runningTasks: TaskLogEntry[];
  completedTasks: TaskLogEntry[];
  onCollapse: () => void;
}

export function PipelineLogPanel({
  runningTasks,
  completedTasks,
  onCollapse,
}: PipelineLogPanelProps) {
  return (
    <div className="w-[260px] flex-shrink-0 flex flex-col min-h-0">
      {/* 로그 헤더 + 접기 버튼 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-secondary)]">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">태스크 로그</span>
        <button
          type="button"
          onClick={onCollapse}
          className="flex items-center gap-0.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          title="로그 패널 접기"
        >
          접기 <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* 로그 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* 실행 중 */}
        {runningTasks.length > 0 && (
          <div>
            <h4 className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1.5 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              실행 중
            </h4>
            <div className="space-y-1">
              {runningTasks.map((t) => (
                <div
                  key={t.label}
                  className="rounded-md bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/50 px-2.5 py-1.5"
                >
                  <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                    {t.label}
                  </span>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t.preview}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 완료 로그 */}
        {completedTasks.length > 0 && (
          <div>
            <h4 className="text-[11px] font-semibold text-[var(--text-tertiary)] mb-1.5 flex items-center gap-1">
              <Check className="h-3 w-3" />
              완료 ({completedTasks.length})
            </h4>
            <div className="space-y-0.5">
              {completedTasks.map((t) => (
                <div key={t.label} className="flex items-start gap-1.5 py-1 px-1.5">
                  <Check className="h-3 w-3 shrink-0 text-emerald-500 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {t.label}
                    </span>
                    {t.elapsedMs != null && (
                      <span className="text-[9px] text-[var(--text-placeholder)] ml-1">
                        {formatElapsed(t.elapsedMs)}
                      </span>
                    )}
                    <p className="text-[9px] text-[var(--text-tertiary)] truncate">{t.preview}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {runningTasks.length === 0 && completedTasks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[11px] text-[var(--text-placeholder)]">
            전체 실행 또는 개별 셀을 클릭하세요
          </div>
        )}
      </div>
    </div>
  );
}
