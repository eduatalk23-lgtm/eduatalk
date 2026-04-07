"use client";

// ============================================
// AI 파이프라인 조종석 패널 (Cockpit View)
// 상단: 전체 그리드 (학년 × Phase) — 항상 모든 학년 표시
// 하단: 실행 중인 태스크 상세 로그
// ============================================

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  gradeAwarePipelineStatusQueryOptions,
  studentRecordKeys,
} from "@/lib/query-options/studentRecord";
import {
  GRADE_PIPELINE_TASK_KEYS,
  SYNTHESIS_PIPELINE_TASK_KEYS,
  type GradePipelineTaskKey,
  type SynthesisPipelineTaskKey,
} from "@/lib/domains/student-record/pipeline-types";
import { checkPipelineStalenessAction } from "@/lib/domains/student-record/actions/staleness";
import { useSidePanel } from "@/components/side-panel";
import {
  Sparkles,
  X,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Target,
  Info,
  TriangleAlert,
} from "lucide-react";
import {
  GRADE_TASK_LABEL_MAP,
  SYNTH_TASK_LABEL_MAP,
} from "./pipeline/pipeline-constants";
import { usePipelineExecution } from "./pipeline/usePipelineExecution";
import { PipelineGradeGrid } from "./pipeline/PipelineGradeGrid";
import {
  PipelineSynthesisGrid,
  PipelineLogPanel,
} from "./pipeline/PipelineSynthesisGrid";

// ─── 메인 패널 ──────────────────────────────────────────────────────────────

interface PipelinePanelAppProps {
  studentId: string;
  tenantId: string;
  /** 진로 설정 여부 — false면 빈 상태 렌더링 */
  hasTargetMajor: boolean;
  /** 파이프라인 완료 후 "결과 리뷰" 클릭 시 호출 */
  onReview?: () => void;
}

export function PipelinePanelApp({
  studentId,
  tenantId,
  hasTargetMajor,
  onReview,
}: PipelinePanelAppProps) {
  const { closePanel } = useSidePanel();
  const queryClient = useQueryClient();
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);
  const pollingStartRef = useRef<number | null>(null);

  const {
    runningCell,
    runningStartMs,
    isFullRunning,
    runGradePhase,
    runSynthesisPhase,
    runFullSequence,
    stopFullRun,
  } = usePipelineExecution({ studentId, tenantId, pollingStartRef });

  const { data: gradeStatus } = useQuery({
    ...gradeAwarePipelineStatusQueryOptions(studentId),
    refetchInterval: () => {
      if (!runningCell && !isFullRunning) {
        pollingStartRef.current = null;
        return false;
      }
      if (!pollingStartRef.current) pollingStartRef.current = Date.now();
      if (Date.now() - pollingStartRef.current > 3600000) return false;
      return 3000;
    },
  });

  // ─── Stale 감지 ──────────────────────────────────────────────────────────
  // Grade 완료만으로는 부족 — Synthesis가 완료되어야 content_hash가 저장됨
  const allGradesCompletedForStale =
    Object.values(gradeStatus?.gradePipelines ?? {}).length > 0 &&
    Object.values(gradeStatus?.gradePipelines ?? {}).every(
      (p) => p.status === "completed",
    ) &&
    gradeStatus?.synthesisPipeline?.status === "completed";

  const { data: stalenessData } = useQuery({
    queryKey: [...studentRecordKeys.gradeAwarePipeline(studentId), "staleness"],
    queryFn: () => checkPipelineStalenessAction(studentId),
    enabled: allGradesCompletedForStale,
    staleTime: 30_000,
  });
  const isPipelineStale = stalenessData?.isStale ?? false;

  // ─── 파생 상태 ────────────────────────────────────────────────────────────

  const gp = gradeStatus?.gradePipelines ?? {};
  const sp = gradeStatus?.synthesisPipeline ?? null;
  const expectedModes = gradeStatus?.expectedModes ?? {};
  const gradeNumbers = Object.keys(gp).map(Number).sort((a, b) => a - b);
  // 항상 1~3학년 모두 표시 (파이프라인 없는 학년도 표시)
  const displayGrades = [1, 2, 3];
  const allGradesCompleted =
    gradeNumbers.length > 0 &&
    gradeNumbers.every((g) => gp[g]?.status === "completed");
  const allComplete = allGradesCompleted && sp?.status === "completed";
  const isAnyRunning = isFullRunning || !!runningCell;

  // ─── 진행률 계산 ─────────────────────────────────────────────────────────
  const totalTasks =
    displayGrades.length * GRADE_PIPELINE_TASK_KEYS.length +
    SYNTHESIS_PIPELINE_TASK_KEYS.length;
  let completedCount = 0;
  for (const g of displayGrades) {
    const tasks = gp[g]?.tasks ?? {};
    for (const key of GRADE_PIPELINE_TASK_KEYS) {
      if (["completed", "cached", "skipped"].includes(tasks[key] ?? ""))
        completedCount++;
    }
  }
  if (sp) {
    for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
      if (["completed", "cached", "skipped"].includes(sp.tasks[key] ?? ""))
        completedCount++;
    }
  }
  const progressPct =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // ─── 로그 데이터 ─────────────────────────────────────────────────────────

  const runningTasks: Array<{ label: string; preview: string }> = [];
  for (const g of gradeNumbers) {
    const pipeline = gp[g];
    if (!pipeline) continue;
    for (const key of GRADE_PIPELINE_TASK_KEYS) {
      if (pipeline.tasks[key] === "running" && pipeline.previews[key]) {
        runningTasks.push({ label: `${g}학년 ${key}`, preview: pipeline.previews[key] });
      }
    }
  }
  if (sp) {
    for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
      if (sp.tasks[key] === "running" && sp.previews[key]) {
        runningTasks.push({ label: key, preview: sp.previews[key] });
      }
    }
  }

  const completedTasks: Array<{ label: string; preview: string; elapsedMs?: number }> = [];
  for (const g of [1, 2, 3]) {
    const pipeline = gp[g];
    if (!pipeline) continue;
    for (const key of GRADE_PIPELINE_TASK_KEYS) {
      const status = pipeline.tasks[key];
      if (status === "completed" || status === "failed") {
        completedTasks.push({
          label: `${g}학년 ${GRADE_TASK_LABEL_MAP[key as GradePipelineTaskKey] ?? key}`,
          preview: pipeline.previews[key] ?? (status === "failed" ? "실패" : "완료"),
          elapsedMs: pipeline.elapsed?.[key],
        });
      }
    }
  }
  if (sp) {
    for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
      const status = sp.tasks[key];
      if (status === "completed" || status === "failed") {
        completedTasks.push({
          label: SYNTH_TASK_LABEL_MAP[key as SynthesisPipelineTaskKey] ?? key,
          preview: sp.previews[key] ?? (status === "failed" ? "실패" : "완료"),
          elapsedMs: sp.elapsed?.[key],
        });
      }
    }
  }

  // ─── 진로 미설정 빈 상태 ───────────────────────────────────────────────────
  if (!hasTargetMajor) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold">파이프라인 대시보드</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Target className="h-10 w-10 text-[var(--text-placeholder)]" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            진로가 설정되지 않았습니다
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            AI 파이프라인을 실행하려면 먼저 진로를 설정해 주세요.
          </p>
          <button
            type="button"
            onClick={() => {
              closePanel();
              onReview?.();
            }}
            className="rounded-md border border-indigo-200 px-4 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
          >
            진로 설정하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ─── 상단: 컨트롤 바 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-secondary)]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold">파이프라인 대시보드</span>
        </div>
        <div className="flex items-center gap-2">
          {isFullRunning && (
            <button
              type="button"
              onClick={() => stopFullRun(gp, sp)}
              className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
            >
              <X className="inline h-3 w-3 mr-1" />중단
            </button>
          )}
          <button
            type="button"
            onClick={runFullSequence}
            disabled={isAnyRunning}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isFullRunning ? "실행 중..." : "전체 실행"}
          </button>
        </div>
      </div>

      {/* ─── 진행률 + 모드 범례 ──────────────────────────────────────────── */}
      <div className="px-4 py-2 border-b border-[var(--border-secondary)] space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">
              {completedCount} / {totalTasks} 태스크 완료
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {progressPct}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
            <span className="inline-block px-1.5 py-px rounded-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-medium">
              분석
            </span>
            NEIS 기존 기록 분석
          </span>
          <span className="text-[var(--text-placeholder)] text-[11px]">|</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
            <span className="inline-block px-1.5 py-px rounded-sm bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] font-medium">
              설계
            </span>
            AI 가안 생성 포함
          </span>
          <span className="text-[var(--text-placeholder)] text-[11px]">|</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
            <Info className="h-3 w-3" />
            셀 위에 마우스를 올리면 설명 확인
          </span>
        </div>
      </div>

      {/* ─── Stale 배너 ─────────────────────────────────────────────────── */}
      {isPipelineStale && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-700 dark:text-amber-300 truncate">
              입력 데이터가 변경되었습니다. 재분석이 필요합니다.
            </span>
          </div>
          <button
            type="button"
            onClick={runFullSequence}
            disabled={isAnyRunning}
            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            재분석
          </button>
        </div>
      )}

      {/* ─── 2단 레이아웃: 좌=그리드, 우=로그 ─────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* ── 좌: 조종석 그리드 ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 border-r border-[var(--border-secondary)]">
          <PipelineGradeGrid
            displayGrades={displayGrades}
            gp={gp}
            expectedModes={expectedModes}
            runningCell={runningCell}
            runningStartMs={runningStartMs}
            onRunGradePhase={runGradePhase}
          />
          <PipelineSynthesisGrid
            sp={sp}
            gp={gp}
            expectedModes={expectedModes}
            allGradesCompleted={allGradesCompleted}
            runningCell={runningCell}
            runningStartMs={runningStartMs}
            onRunSynthesisPhase={runSynthesisPhase}
          />
        </div>

        {/* ── 우: 태스크 로그 (접기 가능) ─────────────────────────────────── */}
        {!isLogCollapsed && (
          <PipelineLogPanel
            runningTasks={runningTasks}
            completedTasks={completedTasks}
            onCollapse={() => setIsLogCollapsed(true)}
          />
        )}

        {/* ── 로그 접힌 상태: 펼치기 탭 ──────────────────────────────────── */}
        {isLogCollapsed && (
          <button
            type="button"
            onClick={() => setIsLogCollapsed(false)}
            className="flex flex-col items-center justify-center gap-1 w-6 flex-shrink-0 border-l border-[var(--border-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
            title="로그 패널 펼치기"
          >
            <ChevronLeft className="h-3 w-3" />
            <span className="text-[10px] [writing-mode:vertical-lr] rotate-180">로그</span>
          </button>
        )}
      </div>

      {/* ─── 완료 후 결과 리뷰 ──────────────────────────────────────────── */}
      {allComplete && (
        <div className="border-t border-[var(--border-secondary)] px-4 py-2">
          <button
            type="button"
            onClick={() => {
              closePanel();
              onReview?.();
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
          >
            결과 리뷰
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
