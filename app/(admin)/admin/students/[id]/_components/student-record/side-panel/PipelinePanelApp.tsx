"use client";

// ============================================
// AI 파이프라인 조종석 패널 (Cockpit View)
// 상단: 전체 그리드 (학년 × Phase) — 항상 모든 학년 표시
// 하단: 실행 중인 태스크 상세 로그
// ============================================

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  gradeAwarePipelineStatusQueryOptions,
  expectedModesQueryOptions,
  studentRecordKeys,
} from "@/lib/query-options/studentRecord";
import { cleanupStalePipelinesForStudent } from "@/lib/domains/student-record/actions/pipeline-orchestrator-cleanup";
import {
  GRADE_PIPELINE_TASK_KEYS,
  SYNTHESIS_PIPELINE_TASK_KEYS,
} from "@/lib/domains/record-analysis/pipeline/pipeline-config";
import type {
  GradePipelineTaskKey,
  SynthesisPipelineTaskKey,
} from "@/lib/domains/record-analysis/pipeline/pipeline-types";
import {
  checkPipelineStalenessAction,
  checkBlueprintStalenessAction,
} from "@/lib/domains/student-record/actions/staleness";
import {
  rerunBlueprintFromStalenessAction,
  rerunGradePipelineTasks,
} from "@/lib/domains/student-record/actions/pipeline-orchestrator-rerun";
import { useSidePanel } from "@/components/side-panel";
import { useToast } from "@/components/ui/ToastProvider";
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
  PAST_ANALYTICS_TASK_LABEL_MAP,
  BLUEPRINT_TASK_LABEL_MAP,
  BOOTSTRAP_TASK_LABEL_MAP,
} from "./pipeline/pipeline-constants";
import {
  PAST_ANALYTICS_TASK_KEYS,
  BLUEPRINT_TASK_KEYS,
  BOOTSTRAP_TASK_KEYS,
} from "@/lib/domains/record-analysis/pipeline/pipeline-config";
import type {
  PastAnalyticsTaskKey,
  BlueprintTaskKey,
  BootstrapTaskKey,
} from "@/lib/domains/record-analysis/pipeline/pipeline-types";
import { usePipelineExecution } from "./pipeline/usePipelineExecution";
import { PipelineGradeGrid } from "./pipeline/PipelineGradeGrid";
import { PipelinePastBlueprintGrid } from "./pipeline/PipelinePastBlueprintGrid";
import { PipelineBootstrapGrid } from "./pipeline/PipelineBootstrapGrid";
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
  const { showError, showSuccess } = useToast();
  // 측정/개발 전용 디버그 툴 게이트 — 운영 환경에서는 반드시 false(또는 미설정)
  const isPipelineDebugEnabled =
    process.env.NEXT_PUBLIC_ENABLE_PIPELINE_DEBUG_TOOLS === "true";
  const [isLogCollapsed, setIsLogCollapsed] = useState(false);
  const [isResettingPhase2, setIsResettingPhase2] = useState(false);
  const [recoveringGrade, setRecoveringGrade] = useState<number | null>(null);
  const pollingStartRef = useRef<number | null>(null);

  const {
    runningCell,
    runningStartMs,
    isFullRunning,
    isCancelling,
    setIsCancelling,
    runGradePreTask,
    runGradePhase,
    runSynthesisPhase,
    runSynthesisSequence,
    runPastAnalyticsPhase,
    runBlueprintPhase,
    runBootstrapPhase,
    runFullSequence,
    runGradeSequence,
    stopFullRun,
  } = usePipelineExecution({ studentId, tenantId, pollingStartRef });

  // 마운트 시 좀비/stuck 1회 정리 — 폴링 핫패스에서 분리.
  useEffect(() => {
    cleanupStalePipelinesForStudent(studentId).catch(() => {
      // 실패해도 정상 흐름에 영향 없음 (폴링이 곧 최신 상태를 가져옴)
    });
  }, [studentId]);

  const { data: gradeStatus } = useQuery({
    ...gradeAwarePipelineStatusQueryOptions(studentId),
    refetchInterval: (query) => {
      // DB 상태 기반: 페이지 reload 후 다른 탭/세션에서 실행 중인 파이프라인이 있어도 감지
      const data = query.state.data;
      const dbHasRunning =
        Object.values(data?.gradePipelines ?? {}).some(
          (p) => p?.status === "running",
        ) ||
        data?.synthesisPipeline?.status === "running" ||
        data?.pastAnalyticsPipeline?.status === "running" ||
        data?.blueprintPipeline?.status === "running" ||
        data?.bootstrapPipeline?.status === "running";

      if (
        !runningCell &&
        !isFullRunning &&
        !isCancelling &&
        !dbHasRunning
      ) {
        pollingStartRef.current = null;
        return false;
      }
      if (!pollingStartRef.current) pollingStartRef.current = Date.now();
      const elapsed = Date.now() - pollingStartRef.current;
      if (elapsed > 3600000) return false;
      // 백오프: 첫 2분은 3초, 이후 10초 (장기 실행 synthesis 비용 감축)
      return elapsed > 120_000 ? 10_000 : 3000;
    },
  });

  const { data: expectedModes = {} } = useQuery(
    expectedModesQueryOptions(studentId),
  );

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
  // M1-c W3 (2026-04-27): staleness reason 분기 — record_changed vs task_manifest_changed
  const stalenessReason = stalenessData?.reason ?? null;

  // Phase 4a (2026-04-19): Blueprint Staleness Cascade.
  //   main_exploration 변경 후 blueprint 가 stale 인지 별도 체크.
  //   blueprint 완료 상태에서만 의미 있으므로 가드.
  const blueprintCompletedForStale =
    gradeStatus?.blueprintPipeline?.status === "completed";
  const { data: blueprintStaleness } = useQuery({
    queryKey: [...studentRecordKeys.gradeAwarePipeline(studentId), "blueprint-staleness"],
    queryFn: () => checkBlueprintStalenessAction(studentId),
    enabled: blueprintCompletedForStale,
    staleTime: 30_000,
  });
  const isBlueprintStale = blueprintStaleness?.isStale ?? false;

  const handleRerunBlueprintCascade = async () => {
    const result = await rerunBlueprintFromStalenessAction(studentId);
    if (!result.success) {
      showError(result.error ?? "Blueprint 재실행 실패");
      return;
    }
    showSuccess("Blueprint 부터 재실행을 시작합니다");
    await queryClient.invalidateQueries({
      queryKey: studentRecordKeys.gradeAwarePipeline(studentId),
    });
    runFullSequence();
  };

  // M1-c W3 (2026-04-27): 학년별 cascade tier 재실행.
  // P1~P3 (역량 분석) 캐시는 보존하고 P3.6 derive_main_theme + P4~P9 만 reset.
  // 새 cascade 코드 검증 / 코드 변경 후 재측정 시나리오에 사용.
  const handleRerunGrade = async (grade: number) => {
    const pipelineId = gp[grade]?.pipelineId;
    if (!pipelineId) {
      showError(`${grade}학년 파이프라인을 찾을 수 없습니다`);
      return;
    }
    const result = await rerunGradePipelineTasks(pipelineId, [
      "derive_main_theme",
      "setek_guide",
      "changche_guide",
      "haengteuk_guide",
      "slot_generation",
      "draft_generation",
      "draft_analysis",
      "draft_refinement",
    ] as GradePipelineTaskKey[]);
    if (!result.success) {
      showError(result.error ?? `${grade}학년 재실행 실패`);
      return;
    }
    showSuccess(`${grade}학년 cascade tier 재실행을 시작합니다 (P1~P3 캐시 보존)`);
    await queryClient.invalidateQueries({
      queryKey: studentRecordKeys.gradeAwarePipeline(studentId),
    });
    runFullSequence();
  };

  // 권고1 (2026-04-28): P4 setek_guide 부분 생성(90% 게이트 throw) 케이스의 누락 과목 재생성.
  // 풀런 재실행 없이 누락 과목만 보충 → setek_guide row 메타 누적 insert + 본문은
  // ai-guide-gen background 가 처리.
  const handleRecoverSetekGuides = async (grade: number) => {
    if (recoveringGrade != null) return;
    setRecoveringGrade(grade);
    try {
      const { recoverMissingSetekGuidesAction } = await import(
        "@/lib/domains/record-analysis/llm/actions/recoverSetekGuides"
      );
      const r = await recoverMissingSetekGuidesAction(studentId, tenantId, grade);
      if (!r.success) {
        showError(r.error ?? "누락 과목 재생성 실패");
        return;
      }
      const { missingBefore, recovered } = r.data;
      if (missingBefore === 0) {
        showSuccess(`${grade}학년 누락 과목 없음 — 이미 모두 생성됨`);
      } else {
        showSuccess(
          `${grade}학년 누락 ${missingBefore}과목 중 ${recovered}건 메타 생성 — 본문은 background 진행`,
        );
      }
      await queryClient.invalidateQueries({
        queryKey: studentRecordKeys.gradeAwarePipeline(studentId),
      });
    } finally {
      setRecoveringGrade(null);
    }
  };

  // ─── 파생 상태 ────────────────────────────────────────────────────────────

  const gp = gradeStatus?.gradePipelines ?? {};
  const sp = gradeStatus?.synthesisPipeline ?? null;
  const aiGuideProgress = gradeStatus?.aiGuideProgress ?? null;
  const pa = gradeStatus?.pastAnalyticsPipeline ?? null;
  const bp = gradeStatus?.blueprintPipeline ?? null;
  const boot = gradeStatus?.bootstrapPipeline ?? null;

  // 중단 진행 상태 자동 해제: 폴링이 더 이상 running 상태가 아님을 확인하면 cancelling 해제
  useEffect(() => {
    if (!isCancelling) return;
    const stillRunning =
      Object.values(gp).some((p) => p?.status === "running") ||
      sp?.status === "running" ||
      pa?.status === "running" ||
      bp?.status === "running" ||
      boot?.status === "running";
    if (!stillRunning) setIsCancelling(false);
  }, [gp, sp, pa, bp, boot, isCancelling, setIsCancelling]);

  // 중단된 파이프라인이 있는지 (4축×3층: past/blueprint + bootstrap 포함)
  const hasCancelledPipeline =
    Object.values(gp).some((p) => p?.status === "cancelled") ||
    sp?.status === "cancelled" ||
    pa?.status === "cancelled" ||
    bp?.status === "cancelled" ||
    boot?.status === "cancelled";
  // DB에 실제로 running 상태인 파이프라인이 있는지 (페이지 reload 후에도 정확)
  const hasRunningInDb =
    Object.values(gp).some((p) => p?.status === "running") ||
    sp?.status === "running" ||
    pa?.status === "running" ||
    bp?.status === "running" ||
    boot?.status === "running";
  const gradeNumbers = Object.keys(gp).map(Number).sort((a, b) => a - b);
  // 항상 1~3학년 모두 표시 (파이프라인 없는 학년도 표시)
  const displayGrades = [1, 2, 3];
  const allGradesCompleted =
    gradeNumbers.length > 0 &&
    gradeNumbers.every((g) => gp[g]?.status === "completed");
  const allComplete = allGradesCompleted && sp?.status === "completed";
  // 중복 실행 방지: DB running도 포함 (페이지 reload 후 좀비/동시세션 방어)
  const isAnyRunning = isFullRunning || !!runningCell || hasRunningInDb;

  // ─── 진행률 계산 ─────────────────────────────────────────────────────────
  const totalTasks =
    displayGrades.length * GRADE_PIPELINE_TASK_KEYS.length +
    SYNTHESIS_PIPELINE_TASK_KEYS.length +
    PAST_ANALYTICS_TASK_KEYS.length +
    BLUEPRINT_TASK_KEYS.length +
    BOOTSTRAP_TASK_KEYS.length;
  let completedCount = 0;
  const doneStatuses = ["completed", "cached", "skipped"] as const;
  for (const g of displayGrades) {
    const tasks = gp[g]?.tasks ?? {};
    for (const key of GRADE_PIPELINE_TASK_KEYS) {
      if (doneStatuses.includes(tasks[key] as (typeof doneStatuses)[number]))
        completedCount++;
    }
  }
  if (sp) {
    for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
      if (doneStatuses.includes(sp.tasks[key] as (typeof doneStatuses)[number]))
        completedCount++;
    }
  }
  if (pa) {
    for (const key of PAST_ANALYTICS_TASK_KEYS) {
      if (doneStatuses.includes(pa.tasks[key] as (typeof doneStatuses)[number]))
        completedCount++;
    }
  }
  if (bp) {
    for (const key of BLUEPRINT_TASK_KEYS) {
      if (doneStatuses.includes(bp.tasks[key] as (typeof doneStatuses)[number]))
        completedCount++;
    }
  }
  if (boot) {
    for (const key of BOOTSTRAP_TASK_KEYS) {
      if (doneStatuses.includes(boot.tasks[key] as (typeof doneStatuses)[number]))
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
    // 파이프라인 자체가 running 상태일 때만 수집 (cancelled/failed 파이프라인의 잔여 running task는 무시)
    if (pipeline.status !== "running") continue;
    for (const key of GRADE_PIPELINE_TASK_KEYS) {
      if (pipeline.tasks[key] === "running" && pipeline.previews[key]) {
        runningTasks.push({
          label: `${g}학년 ${GRADE_TASK_LABEL_MAP[key as GradePipelineTaskKey] ?? key}`,
          preview: pipeline.previews[key],
        });
      }
    }
  }
  if (sp && sp.status === "running") {
    for (const key of SYNTHESIS_PIPELINE_TASK_KEYS) {
      if (sp.tasks[key] === "running" && sp.previews[key]) {
        runningTasks.push({
          label: SYNTH_TASK_LABEL_MAP[key as SynthesisPipelineTaskKey] ?? key,
          preview: sp.previews[key],
        });
      }
    }
  }
  if (pa && pa.status === "running") {
    for (const key of PAST_ANALYTICS_TASK_KEYS) {
      if (pa.tasks[key] === "running" && pa.previews[key]) {
        runningTasks.push({
          label: PAST_ANALYTICS_TASK_LABEL_MAP[key as PastAnalyticsTaskKey] ?? key,
          preview: pa.previews[key],
        });
      }
    }
  }
  if (bp && bp.status === "running") {
    for (const key of BLUEPRINT_TASK_KEYS) {
      if (bp.tasks[key] === "running" && bp.previews[key]) {
        runningTasks.push({
          label: BLUEPRINT_TASK_LABEL_MAP[key as BlueprintTaskKey] ?? key,
          preview: bp.previews[key],
        });
      }
    }
  }
  if (boot && boot.status === "running") {
    for (const key of BOOTSTRAP_TASK_KEYS) {
      if (boot.tasks[key] === "running" && boot.previews[key]) {
        runningTasks.push({
          label: BOOTSTRAP_TASK_LABEL_MAP[key as BootstrapTaskKey] ?? key,
          preview: boot.previews[key],
        });
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
  if (pa) {
    for (const key of PAST_ANALYTICS_TASK_KEYS) {
      const status = pa.tasks[key];
      if (status === "completed" || status === "failed") {
        completedTasks.push({
          label: PAST_ANALYTICS_TASK_LABEL_MAP[key as PastAnalyticsTaskKey] ?? key,
          preview: pa.previews[key] ?? (status === "failed" ? "실패" : "완료"),
          elapsedMs: pa.elapsed?.[key],
        });
      }
    }
  }
  if (bp) {
    for (const key of BLUEPRINT_TASK_KEYS) {
      const status = bp.tasks[key];
      if (status === "completed" || status === "failed") {
        completedTasks.push({
          label: BLUEPRINT_TASK_LABEL_MAP[key as BlueprintTaskKey] ?? key,
          preview: bp.previews[key] ?? (status === "failed" ? "실패" : "완료"),
          elapsedMs: bp.elapsed?.[key],
        });
      }
    }
  }
  if (boot) {
    for (const key of BOOTSTRAP_TASK_KEYS) {
      const status = boot.tasks[key];
      if (status === "completed" || status === "failed") {
        completedTasks.push({
          label: BOOTSTRAP_TASK_LABEL_MAP[key as BootstrapTaskKey] ?? key,
          preview: boot.previews[key] ?? (status === "failed" ? "실패" : "완료"),
          elapsedMs: boot.elapsed?.[key],
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
          {(isFullRunning || isCancelling) && !allComplete && (
            <button
              type="button"
              onClick={() => stopFullRun(gp, sp, pa, bp, boot)}
              disabled={isCancelling}
              className={
                isCancelling
                  ? "rounded-md border border-amber-200 px-3 py-1 text-xs font-medium text-amber-600 dark:border-amber-800 dark:text-amber-400 cursor-not-allowed"
                  : "rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
              }
            >
              <X className="inline h-3 w-3 mr-1" />
              {isCancelling ? "중단 중..." : "중단"}
            </button>
          )}
          <button
            type="button"
            onClick={runFullSequence}
            disabled={isAnyRunning || isCancelling}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed"
          >
            {isCancelling
              ? "중단 중..."
              : isFullRunning
                ? "실행 중..."
                : "전체 실행"}
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
          <div className="h-1.5 w-full rounded-full bg-bg-tertiary dark:bg-bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-2xs text-[var(--text-tertiary)]">
            <span className="inline-block px-1.5 py-px rounded-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-3xs font-medium">
              분석
            </span>
            NEIS 기존 기록 분석
          </span>
          <span className="text-[var(--text-placeholder)] text-2xs">|</span>
          <span className="inline-flex items-center gap-1 text-2xs text-[var(--text-tertiary)]">
            <span className="inline-block px-1.5 py-px rounded-sm bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-3xs font-medium">
              설계
            </span>
            AI 가안 생성 포함
          </span>
          <span className="text-[var(--text-placeholder)] text-2xs">|</span>
          <span className="inline-flex items-center gap-1 text-2xs text-[var(--text-tertiary)]">
            <Info className="h-3 w-3" />
            셀 위에 마우스를 올리면 설명 확인
          </span>
        </div>
      </div>

      {/* ─── Blueprint Staleness 배너 (Phase 4a, 2026-04-19) ─────────────── */}
      {isBlueprintStale && !isPipelineStale && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-700 dark:text-amber-300 truncate">
              메인 탐구가 수정되었습니다. Blueprint 부터 재분석이 필요합니다.
            </span>
          </div>
          <button
            type="button"
            onClick={handleRerunBlueprintCascade}
            disabled={isAnyRunning}
            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:hover:bg-amber-600 disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-3 w-3" />
            Blueprint 재실행
          </button>
        </div>
      )}

      {/* ─── Stale 배너 ─────────────────────────────────────────────────── */}
      {isPipelineStale && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-700 dark:text-amber-300 truncate">
              {stalenessReason === "task_manifest_changed"
                ? "새 분석 단계가 추가되었습니다. 재실행하면 신규 task 가 자동 합류합니다."
                : "입력 데이터가 변경되었습니다. 재분석이 필요합니다."}
            </span>
          </div>
          <button
            type="button"
            onClick={runFullSequence}
            disabled={isAnyRunning}
            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:hover:bg-amber-600 disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-3 w-3" />
            {stalenessReason === "task_manifest_changed" ? "재분석 (신규 단계 합류)" : "재분석"}
          </button>
        </div>
      )}

      {/* ─── Cancelled 배너 ─────────────────────────────────────────────── */}
      {/*
        2026-04-29: 모순 UX fix — hasCancelledPipeline 만으로는 부족.
        다른 파이프라인이 running 중이면 "이어서 실행" 클릭 불가 (DB unique 제약 + isAnyRunning).
        배너는 "이어서 실행 즉시 가능" 케이스에서만 표시.
        다른 학년/타입 진행 중인 경우 다른 배너로 안내.
      */}
      {hasCancelledPipeline && !isFullRunning && !isCancelling && !hasRunningInDb && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <X className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-700 dark:text-amber-300 truncate">
              파이프라인이 중단되었습니다. 다시 실행하면 완료된 태스크는 건너뛰고 이어서 진행됩니다.
            </span>
          </div>
          <button
            type="button"
            onClick={runFullSequence}
            disabled={isAnyRunning}
            className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:hover:bg-amber-600 disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-3 w-3" />
            이어서 실행
          </button>
        </div>
      )}

      {/* ─── 좀비 의심 배너 — running 인데 5분 idle (heartbeat 정지) ─── */}
      {hasCancelledPipeline && hasRunningInDb && !isFullRunning && !isCancelling && (
        <div className="flex items-center justify-between gap-2 border-b border-orange-200 bg-orange-50 px-4 py-2 dark:border-orange-800/50 dark:bg-orange-950/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <X className="h-3.5 w-3.5 shrink-0 text-orange-600 dark:text-orange-400" />
            <span className="text-xs text-orange-700 dark:text-orange-300 truncate">
              이전 실행이 중단된 흔적이 있고 다른 파이프라인이 실행 중입니다. 진행 중 학년이 끝나거나 좀비 정리(5분 idle) 후 이어서 실행할 수 있습니다.
            </span>
          </div>
        </div>
      )}

      {/* ─── 2단 레이아웃: 좌=그리드, 우=로그 ─────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* ── 좌: 조종석 그리드 ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 border-r border-[var(--border-secondary)]">
          <PipelineBootstrapGrid
            boot={boot}
            runningCell={runningCell}
            runningStartMs={runningStartMs}
            onRunBootstrapPhase={runBootstrapPhase}
          />
          <PipelineGradeGrid
            displayGrades={displayGrades}
            gp={gp}
            expectedModes={expectedModes}
            runningCell={runningCell}
            runningStartMs={runningStartMs}
            onRunGradePhase={runGradePhase}
            onRunGradeSequence={runGradeSequence}
            onRerunGrade={handleRerunGrade}
            isGradeRunDisabled={isAnyRunning || isCancelling}
            onRecoverSetekGuides={handleRecoverSetekGuides}
            recoveringGrade={recoveringGrade}
            onRunGradePreTask={runGradePreTask}
          />
          <PipelinePastBlueprintGrid
            pa={pa}
            bp={bp}
            expectedModes={expectedModes}
            runningCell={runningCell}
            runningStartMs={runningStartMs}
            onRunPastPhase={runPastAnalyticsPhase}
            onRunBlueprintPhase={runBlueprintPhase}
          />
          {/* 트랙 D (2026-04-14): Phase 2 재실행 — narrative chunk 분할 효과 측정용.
              NEXT_PUBLIC_ENABLE_PIPELINE_DEBUG_TOOLS=true 인 환경에서만 노출.
              synthesis 파이프라인이 존재하고 Phase 2 관련 태스크가 한 번이라도 돈 경우에만 노출. */}
          {isPipelineDebugEnabled &&
            sp?.pipelineId &&
            (sp.tasks.guide_matching === "completed" ||
              sp.tasks.narrative_arc_extraction === "completed" ||
              sp.status === "completed" ||
              sp.status === "failed") && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border-secondary)] bg-[var(--bg-subtle)] px-3 py-2">
                <div className="text-xs text-[var(--text-secondary)]">
                  <div className="font-medium text-[var(--text-primary)]">
                    Phase 2 재실행 (narrative chunk 측정)
                  </div>
                  <div className="mt-0.5 text-2xs text-[var(--text-tertiary)]">
                    [개발 전용] narrative/hyperedge/edge/guide_matching/haengteuk 초기화 + 파생 DB 클린업
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isResettingPhase2 || isAnyRunning || isCancelling}
                  onClick={async () => {
                    if (!sp?.pipelineId) return;
                    if (!window.confirm("⚠️ [개발/측정 전용] 이 작업은 DB 데이터를 영구 삭제합니다.\n\nPhase 2 태스크(narrative/hyperedge/edge/assignments/haengteuk_links)를 초기화하고 파생 DB를 삭제합니다.\n\n측정·개발 목적이 아니라면 반드시 취소하세요. 계속하시겠습니까?")) return;
                    setIsResettingPhase2(true);
                    try {
                      const res = await fetch("/api/admin/pipeline/synthesis/rerun", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          pipelineId: sp.pipelineId,
                          taskKeys: [
                            "edge_computation",
                            "hyperedge_computation",
                            "narrative_arc_extraction",
                            "guide_matching",
                            "haengteuk_linking",
                          ],
                        }),
                      });
                      if (!res.ok) {
                        const body = (await res.json().catch(() => ({}))) as { error?: string };
                        throw new Error(body.error ?? `HTTP ${res.status}`);
                      }
                      await queryClient.invalidateQueries({
                        queryKey: studentRecordKeys.gradeAwarePipeline(studentId),
                      });
                      showSuccess("Phase 2 초기화 완료 — Phase 2 셀을 클릭하여 재실행하세요");
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "재실행 세팅 실패";
                      showError(`Phase 2 재실행 실패: ${msg}`);
                    } finally {
                      setIsResettingPhase2(false);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${isResettingPhase2 ? "animate-spin" : ""}`}
                  />
                  {isResettingPhase2 ? "초기화 중..." : "Phase 2 초기화"}
                </button>
              </div>
            )}
          <PipelineSynthesisGrid
            sp={sp}
            gp={gp}
            expectedModes={expectedModes}
            allGradesCompleted={allGradesCompleted}
            runningCell={runningCell}
            runningStartMs={runningStartMs}
            isAnyRunning={isAnyRunning}
            isCancelling={isCancelling}
            onRunSynthesisPhase={runSynthesisPhase}
            onRunSynthesisSequence={runSynthesisSequence}
            aiGuideProgress={aiGuideProgress}
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
            <span className="text-3xs [writing-mode:vertical-lr] rotate-180">로그</span>
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
