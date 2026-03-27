"use client";

import { useState, useEffect } from "react";
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

  // 파이프라인 상태 폴링
  const { data: pipeline } = useQuery({
    ...pipelineStatusQueryOptions(studentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" ? 3000 : false;
    },
  });

  // 실행 mutation
  const runMutation = useMutation({
    mutationFn: () => runInitialAnalysisPipeline(studentId, tenantId),
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
    mutationFn: () => resumePipeline(pipeline?.id ?? ""),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.pipeline(studentId),
      });
    },
  });

  // P2-3: 개별 태스크 재실행 mutation
  const [rerunningTask, setRerunningTask] = useState<string | null>(null);
  const rerunTaskMutation = useMutation({
    mutationFn: (taskKey: PipelineTaskKey) => {
      setRerunningTask(taskKey);
      return rerunPipelineTasks(pipeline?.id ?? "", [taskKey]);
    },
    onSettled: () => setRerunningTask(null),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.pipeline(studentId),
      });
    },
  });

  const isActionPending = runMutation.isPending || resumeMutation.isPending || rerunTaskMutation.isPending;

  // 완료 후 10초 → badge 축소
  useEffect(() => {
    if (pipeline?.status === "completed" || pipeline?.status === "failed") {
      const timer = setTimeout(() => setCollapsed(true), 10_000);
      return () => clearTimeout(timer);
    }
    setCollapsed(false);
  }, [pipeline?.status]);

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

  // 진로 미설정 → 표시 안 함 (CareerSetupBanner가 처리)
  if (!hasTargetMajor) return null;

  const completedCount = pipeline
    ? PIPELINE_TASK_KEYS.filter((k) => pipeline.tasks[k] === "completed").length
    : 0;

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
          <Check className="h-3 w-3" />
        ) : (
          <AlertCircle className="h-3 w-3" />
        )}
        AI 분석 {completedCount}/{PIPELINE_TASK_KEYS.length}
        <ChevronRight className="ml-auto h-3 w-3" />
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
            <span>
              {(() => {
                const currentTask = PIPELINE_TASK_KEYS.find((k) => pipeline.tasks[k] === "running");
                return currentTask ? PIPELINE_TASK_LABELS[currentTask] : "대기 중";
              })()}...
            </span>
            {completedCount >= 2 && pipeline.startedAt && (
              <span>
                약 {Math.ceil(
                  ((Date.now() - new Date(pipeline.startedAt).getTime()) / completedCount
                    * (PIPELINE_TASK_KEYS.length - completedCount)) / 60000
                )}분 남음
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-1.5 flex flex-col gap-1">
        {PIPELINE_TASK_KEYS.map((key) => {
          const status = pipeline.tasks[key] ?? "pending";
          const preview = pipeline.taskPreviews[key];
          const Icon = TASK_ICONS[status];

          const canRerun = (status === "completed" || status === "failed") && pipeline.status !== "running";

          return (
            <div key={key} className="group flex items-center gap-1.5">
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
                {PIPELINE_TASK_LABELS[key]}
                {preview && status === "completed" && (
                  <span className="text-[var(--text-tertiary)]"> — {preview}</span>
                )}
              </span>
              {canRerun && (
                <button
                  type="button"
                  title={`${PIPELINE_TASK_LABELS[key]} 재실행`}
                  onClick={() => rerunTaskMutation.mutate(key)}
                  disabled={isActionPending}
                  className="shrink-0 rounded p-0.5 text-[var(--text-tertiary)] opacity-0 hover:text-indigo-600 group-hover:opacity-100 disabled:opacity-30"
                >
                  {rerunningTask === key ? (
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
