"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pipelineStatusQueryOptions, studentRecordKeys } from "@/lib/query-options/studentRecord";
import { runInitialAnalysisPipeline, cancelPipeline, resumePipeline, rerunPipelineTasks } from "@/lib/domains/student-record/actions/pipeline";
import {
  PIPELINE_TASK_KEYS,
  PIPELINE_TASK_LABELS,
  type PipelineTaskKey,
  type PipelineTaskStatus,
} from "@/lib/domains/student-record/pipeline-types";
import { cn } from "@/lib/cn";
import { Sparkles, Check, Loader2, AlertCircle, X, ChevronRight, TriangleAlert, RefreshCw, Play } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { checkPipelineStalenessAction } from "@/lib/domains/student-record/actions/staleness";

// ─── Phase 그룹 정의 (8-Phase 분할) ─────────────────────────────────────
const PHASES: Array<{ label: string; description: string; keys: PipelineTaskKey[] }> = [
  { label: "Phase 1", description: "역량 분석", keys: ["competency_analysis"] },
  { label: "Phase 2", description: "스토리라인", keys: ["storyline_generation"] },
  { label: "Phase 3", description: "연결 그래프", keys: ["edge_computation", "guide_matching"] },
  { label: "Phase 4", description: "진단 + 매칭", keys: ["ai_diagnosis", "course_recommendation"] },
  { label: "Phase 5", description: "진로 추천 + 세특", keys: ["bypass_analysis", "setek_guide"] },
  { label: "Phase 6", description: "창체 + 행특", keys: ["changche_guide", "haengteuk_guide"] },
  { label: "Phase 7", description: "요약 + 전략", keys: ["activity_summary", "ai_strategy"] },
  { label: "Phase 8", description: "면접 + 로드맵", keys: ["interview_generation", "roadmap_generation"] },
];

/** 현재 태스크 상태에서 다음 실행할 Phase 번호 반환. 모두 완료면 0. */
function getNextPhaseFromTasks(tasks: Record<string, PipelineTaskStatus>): number {
  if (tasks.competency_analysis !== "completed") return 1;
  if (tasks.storyline_generation !== "completed") return 2;
  if (tasks.edge_computation !== "completed" || tasks.guide_matching !== "completed") return 3;
  if (tasks.ai_diagnosis !== "completed" || tasks.course_recommendation !== "completed") return 4;
  if (tasks.bypass_analysis !== "completed" || tasks.setek_guide !== "completed") return 5;
  if (tasks.changche_guide !== "completed" || tasks.haengteuk_guide !== "completed") return 6;
  if (tasks.activity_summary !== "completed" || tasks.ai_strategy !== "completed") return 7;
  if (tasks.interview_generation !== "completed" || tasks.roadmap_generation !== "completed") return 8;
  return 0;
}

interface PipelineSidebarWidgetProps {
  studentId: string;
  tenantId: string;
  hasTargetMajor: boolean;
  onReview?: () => void;
}

const TASK_ICONS: Record<PipelineTaskStatus, typeof Check> = {
  completed: Check,
  running: Loader2,
  failed: AlertCircle,
  pending: Loader2,
};

export function PipelineSidebarWidget({
  studentId,
  tenantId,
  hasTargetMajor,
  onReview,
}: PipelineSidebarWidgetProps) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRerunConfirm, setShowRerunConfirm] = useState(false);

  // 파이프라인 상태 폴링 (40분 타임아웃 — 8 Phase × 5분)
  const pollingStartRef = useRef<number | null>(null);
  const PIPELINE_POLLING_TIMEOUT = 40 * 60 * 1000;

  const { data: pipeline } = useQuery({
    ...pipelineStatusQueryOptions(studentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status !== "running") {
        pollingStartRef.current = null;
        return false;
      }
      if (!pollingStartRef.current) pollingStartRef.current = Date.now();
      if (Date.now() - pollingStartRef.current > PIPELINE_POLLING_TIMEOUT) {
        pollingStartRef.current = null;
        return false; // 40분 초과 → 폴링 중단
      }
      return 3000;
    },
  });

  // ─── 클라이언트 주도 Phase 순차 실행 ─────────────────────────
  // 폴링에서 현재 Phase 완료를 감지하면 다음 Phase API를 호출
  const runningPhaseRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pipeline || pipeline.status !== "running") {
      runningPhaseRef.current = null;
      return;
    }

    const tasks = pipeline.tasks;
    // 모든 태스크 중 하나라도 "running"이면 현재 Phase 실행 중 → 대기
    const hasRunningTask = Object.values(tasks).some((s) => s === "running");
    if (hasRunningTask) return;

    // 다음 실행할 Phase 판별
    const nextPhase = getNextPhaseFromTasks(tasks);
    if (nextPhase === 0) return; // 전부 완료 → 서버에서 상태 갱신됨

    // 이미 이 Phase를 호출했으면 중복 방지
    if (runningPhaseRef.current === nextPhase) return;
    runningPhaseRef.current = nextPhase;

    const phaseRoute = nextPhase === 1 ? "/api/admin/pipeline/run" : `/api/admin/pipeline/phase-${nextPhase}`;
    fetch(phaseRoute, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineId: pipeline.id }),
    }).catch(() => {});
  }, [pipeline]);

  // 실행 mutation — Server Action(placeholder) + API route(실행)
  const runMutation = useMutation({
    mutationFn: async () => {
      const result = await runInitialAnalysisPipeline(studentId, tenantId);
      if (result.success && result.data) {
        const { pipelineId, studentId: sid, tenantId: tid, studentSnapshot } = result.data;
        fetch("/api/admin/pipeline/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pipelineId, studentId: sid, tenantId: tid, studentSnapshot }),
        }).catch(() => {});
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.pipeline(studentId),
      });
    },
  });

  // 취소 mutation
  const cancelMutation = useMutation({
    mutationFn: () => cancelPipeline(pipeline?.id ?? ""),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.pipeline(studentId),
      });
    },
  });

  // 이어서 분석 mutation (실패 파이프라인 재개)
  const resumeMutation = useMutation({
    mutationFn: async () => {
      const result = await resumePipeline(pipeline?.id ?? "");
      if (result.success && result.data) {
        const { pipelineId, studentId: sid, tenantId: tid, studentSnapshot, existingState } = result.data;
        fetch("/api/admin/pipeline/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pipelineId, studentId: sid, tenantId: tid, studentSnapshot, existingState }),
        }).catch(() => {});
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.pipeline(studentId),
      });
    },
  });

  // P2-3: 개별 태스크 재실행 mutation
  const [rerunningTask, setRerunningTask] = useState<string | null>(null);
  const rerunTaskMutation = useMutation({
    mutationFn: async (taskKey: PipelineTaskKey) => {
      setRerunningTask(taskKey);
      const result = await rerunPipelineTasks(pipeline?.id ?? "", [taskKey]);
      if (result.success && result.data) {
        const { pipelineId, studentId: sid, tenantId: tid, studentSnapshot, existingState } = result.data;
        fetch("/api/admin/pipeline/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pipelineId, studentId: sid, tenantId: tid, studentSnapshot, existingState }),
        }).catch(() => {});
      }
      return result;
    },
    onSettled: () => setRerunningTask(null),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.pipeline(studentId),
      });
    },
  });

  const isActionPending = runMutation.isPending || resumeMutation.isPending || rerunTaskMutation.isPending;

  // 완료 후 30초 → badge 축소 (렌더 중 상태 조정 + 비동기 축소)
  const pipelineStatus = pipeline?.status ?? null;
  const [prevStatus, setPrevStatus] = useState(pipelineStatus);
  if (pipelineStatus !== prevStatus) {
    setPrevStatus(pipelineStatus);
    if (pipelineStatus !== "completed" && pipelineStatus !== "failed") {
      setCollapsed(false);
    }
  }
  useEffect(() => {
    if (pipelineStatus === "completed" || pipelineStatus === "failed") {
      const timer = setTimeout(() => setCollapsed(true), 30_000);
      return () => clearTimeout(timer);
    }
  }, [pipelineStatus]);

  // 완료 시 관련 쿼리 무효화
  useEffect(() => {
    if (pipeline?.status === "completed") {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.all });
    }
  }, [pipeline?.status, queryClient]);

  // Phase E3: 파이프라인 완료 후 stale 여부 체크
  const { data: stalenessData } = useQuery({
    queryKey: [...studentRecordKeys.pipeline(studentId), "staleness"],
    queryFn: () => checkPipelineStalenessAction(studentId),
    enabled: pipeline?.status === "completed",
    staleTime: 30_000,
  });
  const isPipelineStale = stalenessData?.isStale ?? false;

  // ETA 계산 (폴링마다 갱신, 렌더 순수성 유지)
  const [etaNow, setEtaNow] = useState(() => Date.now());
  useEffect(() => {
    if (pipelineStatus !== "running") return;
    // 즉시 1회 + 5초 간격
    const interval = setInterval(() => setEtaNow(Date.now()), 5000);
    const raf = requestAnimationFrame(() => setEtaNow(Date.now()));
    return () => { clearInterval(interval); cancelAnimationFrame(raf); };
  }, [pipelineStatus]);

  // 진로 미설정 → 표시 안 함 (CareerSetupBanner가 처리)
  if (!hasTargetMajor) return null;

  const completedCount = pipeline
    ? PIPELINE_TASK_KEYS.filter((k) => pipeline.tasks[k] === "completed").length
    : 0;

  const estimatedMinutesLeft = completedCount >= 2 && pipeline?.startedAt
    ? Math.ceil(
        ((etaNow - new Date(pipeline.startedAt).getTime()) / completedCount
          * (PIPELINE_TASK_KEYS.length - completedCount)) / 60000
      )
    : null;
  const currentTaskLabel = pipeline?.status === "running"
    ? (PIPELINE_TASK_LABELS[PIPELINE_TASK_KEYS.find((k) => pipeline.tasks[k] === "running") ?? ""] ?? "대기 중")
    : null;

  // 파이프라인 없음 → CTA 표시
  if (!pipeline || pipeline.status === "cancelled") {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2 dark:border-indigo-800 dark:bg-indigo-950/20">
        <p className="text-[10px] text-indigo-700 dark:text-indigo-300">
          AI 초기 분석을 실행하면 전 영역의 초안이 생성됩니다
        </p>
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          {runMutation.isPending ? "시작 중..." : "AI 초기 분석"}
        </button>
      </div>
    );
  }

  // 완료 후 축소 → badge
  if (collapsed && (pipeline.status === "completed" || pipeline.status === "failed")) {
    const topPreviews = Object.entries(pipeline.taskPreviews)
      .filter(([, v]) => v)
      .slice(0, 3)
      .map(([, v]) => (v.split("—").pop()?.trim() ?? v).slice(0, 10))
      .join(" · ");
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium",
          pipeline.status === "completed"
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-amber-700 dark:text-amber-400",
        )}
      >
        {pipeline.status === "completed" ? (
          <Check className="h-3 w-3 shrink-0" />
        ) : (
          <AlertCircle className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">
          AI 분석 {completedCount}/{PIPELINE_TASK_KEYS.length}
          {topPreviews && <span className="ml-1 text-[var(--text-tertiary)]">— {topPreviews}</span>}
        </span>
        <ChevronRight className="ml-auto h-3 w-3 shrink-0" />
      </button>
    );
  }

  // 실행 중 / 완료 상세 → 태스크 목록
  return (
    <div className="rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-secondary)] px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[var(--text-primary)]">
          {pipeline.status === "running" ? "AI 초기 분석 중" : "AI 초기 분석 결과"}{" "}
          {completedCount}/{PIPELINE_TASK_KEYS.length}
        </span>
        {pipeline.status === "running" && (
          <>
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="rounded p-0.5 text-[var(--text-tertiary)] hover:text-red-500"
              title="취소"
            >
              <X className="h-3 w-3" />
            </button>
            <ConfirmDialog
              open={showCancelConfirm}
              onOpenChange={setShowCancelConfirm}
              title="AI 분석 취소"
              description="진행 중인 AI 분석을 취소하시겠습니까? 완료된 태스크 결과는 유지됩니다."
              onConfirm={() => { cancelMutation.mutate(); setShowCancelConfirm(false); }}
              variant="destructive"
              isLoading={cancelMutation.isPending}
            />
          </>
        )}
      </div>

      {/* U-3: 프로그레스 바 + ETA */}
      {pipeline.status === "running" && (
        <div className="mt-1.5 mb-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${Math.round((completedCount / PIPELINE_TASK_KEYS.length) * 100)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
            <span>{currentTaskLabel ?? "대기 중"}...</span>
            {estimatedMinutesLeft != null && (
              <span>약 {estimatedMinutesLeft}분 남음</span>
            )}
          </div>
        </div>
      )}

      <div className="mt-1.5 flex flex-col gap-2">
        {PHASES.map((phase) => {
          const phaseStatuses = phase.keys.map((k) => pipeline.tasks[k] ?? "pending");
          const completedInPhase = phaseStatuses.filter((s) => s === "completed").length;
          const allCompleted = completedInPhase === phase.keys.length;
          const anyRunning = phaseStatuses.some((s) => s === "running");
          const allPending = phaseStatuses.every((s) => s === "pending");

          return (
            <div key={phase.label}>
              {/* Phase 헤더 */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn(
                  "text-[10px] font-semibold shrink-0",
                  allCompleted ? "text-emerald-600 dark:text-emerald-400" :
                    anyRunning ? "text-indigo-600 dark:text-indigo-400" :
                      "text-[var(--text-tertiary)]",
                )}>
                  {phase.label}
                </span>
                <div className="h-1 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.round((completedInPhase / phase.keys.length) * 100)}%` }}
                  />
                </div>
                <span className="text-[9px] text-[var(--text-placeholder)] shrink-0">{phase.description}</span>
              </div>

              {/* Phase 내 태스크 목록 */}
              {allCompleted ? (
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 pl-1">
                  {phase.keys.map((k) => (
                    <span key={k} className="text-[9px] text-emerald-600 dark:text-emerald-400">
                      ✓ {PIPELINE_TASK_LABELS[k]}
                    </span>
                  ))}
                </div>
              ) : allPending ? (
                <p className="pl-1 text-[9px] text-[var(--text-placeholder)]">{phase.keys.length}개 대기</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {phase.keys.map((k) => {
                    const status = pipeline.tasks[k] ?? "pending";
                    const preview = pipeline.taskPreviews[k];
                    const Icon = TASK_ICONS[status];
                    const canRerun = (status === "completed" || status === "failed") && pipeline.status !== "running";

                    return (
                      <div key={k} className="group flex items-center gap-1.5">
                        <Icon
                          className={cn(
                            "h-3 w-3 shrink-0",
                            status === "completed" && "text-emerald-500",
                            status === "running" && "animate-spin text-indigo-500",
                            status === "failed" && "text-red-500",
                            status === "pending" && "text-[var(--text-tertiary)] opacity-30",
                          )}
                        />
                        <span className={cn(
                          "flex-1 truncate text-[10px]",
                          status === "pending" ? "text-[var(--text-tertiary)]" : "text-[var(--text-secondary)]",
                        )}>
                          {PIPELINE_TASK_LABELS[k]}
                          {preview && status === "completed" && (
                            <span className="text-[var(--text-tertiary)]"> — {preview}</span>
                          )}
                        </span>
                        {canRerun && (
                          <button
                            type="button"
                            title={`${PIPELINE_TASK_LABELS[k]} 재실행`}
                            onClick={() => rerunTaskMutation.mutate(k)}
                            disabled={isActionPending}
                            className="shrink-0 rounded p-0.5 text-[var(--text-tertiary)] opacity-0 hover:text-indigo-600 group-hover:opacity-100 disabled:opacity-30"
                          >
                            {rerunningTask === k ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-2.5 w-2.5" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Phase E3: stale 경고 + 재분석 버튼 */}
      {isPipelineStale && pipeline.status === "completed" && (
        <div className="mt-1.5 rounded-md bg-amber-50 px-2 py-1.5 dark:bg-amber-950/30">
          <div className="flex items-center gap-1">
            <TriangleAlert className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-700 dark:text-amber-300">
              분석 후 기록이 변경되었습니다
            </span>
          </div>
          <button
            type="button"
            onClick={() => runMutation.mutate()}
            disabled={isActionPending}
            className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            {runMutation.isPending ? "시작 중..." : "재분석"}
          </button>
        </div>
      )}

      {/* 실패 → 이어서 분석 버튼 */}
      {pipeline.status === "failed" && (
        <button
          type="button"
          onClick={() => resumeMutation.mutate()}
          disabled={isActionPending}
          className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Play className="h-3 w-3" />
          {resumeMutation.isPending ? "재시작 중..." : "이어서 분석"}
        </button>
      )}

      {/* 완료(fresh) → 재분석 버튼 (확인 다이얼로그) */}
      {pipeline.status === "completed" && !isPipelineStale && (
        <>
          <button
            type="button"
            onClick={() => setShowRerunConfirm(true)}
            disabled={isActionPending}
            className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-md border border-[var(--border-secondary)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)] disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            재분석
          </button>
          <ConfirmDialog
            open={showRerunConfirm}
            onOpenChange={setShowRerunConfirm}
            title="AI 재분석"
            description="이미 분석이 완료되었습니다. 새로 분석하시겠습니까? 기존 결과는 이전 파이프라인에 보존됩니다."
            onConfirm={() => { runMutation.mutate(); setShowRerunConfirm(false); }}
            isLoading={runMutation.isPending}
          />
        </>
      )}

      {/* 완료 후 결과 리뷰 링크 */}
      {(pipeline.status === "completed" || pipeline.status === "failed") && (
        <button
          type="button"
          onClick={() => onReview?.()}
          className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-indigo-200 px-2 py-1 text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
        >
          결과 리뷰
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
