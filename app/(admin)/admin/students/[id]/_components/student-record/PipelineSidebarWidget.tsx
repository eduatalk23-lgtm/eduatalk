"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pipelineStatusQueryOptions, studentRecordKeys } from "@/lib/query-options/studentRecord";
import { runInitialAnalysisPipeline, cancelPipeline } from "@/lib/domains/student-record/actions/pipeline";
import {
  PIPELINE_TASK_KEYS,
  PIPELINE_TASK_LABELS,
  type PipelineTaskKey,
  type PipelineTaskStatus,
} from "@/lib/domains/student-record/pipeline-types";
import { cn } from "@/lib/cn";
import { Sparkles, Check, Loader2, AlertCircle, X, ChevronRight } from "lucide-react";

interface PipelineSidebarWidgetProps {
  studentId: string;
  tenantId: string;
  hasTargetMajor: boolean;
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
}: PipelineSidebarWidgetProps) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);

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
          <button
            type="button"
            onClick={() => cancelMutation.mutate()}
            className="rounded p-0.5 text-[var(--text-tertiary)] hover:text-red-500"
            title="취소"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="mt-1.5 flex flex-col gap-1">
        {PIPELINE_TASK_KEYS.map((key) => {
          const status = pipeline.tasks[key] ?? "pending";
          const preview = pipeline.taskPreviews[key];
          const Icon = TASK_ICONS[status];

          return (
            <div key={key} className="flex items-center gap-1.5">
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
            </div>
          );
        })}
      </div>

      {/* 완료 후 결과 리뷰 링크 */}
      {(pipeline.status === "completed" || pipeline.status === "failed") && (
        <button
          type="button"
          onClick={() => {
            const target = document.getElementById("sec-course-plan");
            target?.scrollIntoView({ behavior: "smooth" });
          }}
          className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-indigo-200 px-2 py-1 text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
        >
          결과 리뷰
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
