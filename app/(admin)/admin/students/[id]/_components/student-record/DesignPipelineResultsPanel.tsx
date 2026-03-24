"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pipelineStatusQueryOptions, studentRecordKeys } from "@/lib/query-options/studentRecord";
import {
  PIPELINE_TASK_KEYS,
  PIPELINE_TASK_LABELS,
  type PipelineTaskKey,
} from "@/lib/domains/student-record/pipeline-types";
import { cn } from "@/lib/cn";
import { Check, AlertCircle, RotateCcw, ChevronRight } from "lucide-react";

interface DesignPipelineResultsPanelProps {
  studentId: string;
  tenantId: string;
}

const SECTION_SCROLL_MAP: Record<PipelineTaskKey, string> = {
  competency_analysis: "sec-diagnosis-analysis",
  ai_diagnosis: "sec-diagnosis-overall",
  storyline_generation: "sec-storyline",
  course_recommendation: "sec-course-plan",
  guide_matching: "sec-exploration-guide",
  setek_guide: "sec-setek-guide",
  activity_summary: "sec-activity-summary",
};

export function DesignPipelineResultsPanel({
  studentId,
  tenantId,
}: DesignPipelineResultsPanelProps) {
  const queryClient = useQueryClient();

  const { data: pipeline } = useQuery({
    ...pipelineStatusQueryOptions(studentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" ? 3000 : false;
    },
  });

  const [checkedTasks, setCheckedTasks] = useState<Set<PipelineTaskKey>>(
    new Set(PIPELINE_TASK_KEYS),
  );

  // 파이프라인 없거나 pending → 표시 안 함
  if (!pipeline || pipeline.status === "pending" || pipeline.status === "cancelled") {
    return null;
  }

  const completedTasks = PIPELINE_TASK_KEYS.filter(
    (k) => pipeline.tasks[k] === "completed",
  );
  const failedTasks = PIPELINE_TASK_KEYS.filter(
    (k) => pipeline.tasks[k] === "failed",
  );

  // 실행 중이면 간단한 진행 표시
  if (pipeline.status === "running") {
    const done = completedTasks.length;
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-950/20">
        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
          AI 초기 분석 진행 중... ({done}/{PIPELINE_TASK_KEYS.length})
        </p>
      </div>
    );
  }

  // 완료/실패 → 결과 패널
  const toggleCheck = (key: PipelineTaskKey) => {
    setCheckedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const scrollToSection = (key: PipelineTaskKey) => {
    const sectionId = SECTION_SCROLL_MAP[key];
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="rounded-lg border border-[var(--border-secondary)] bg-white p-4 dark:bg-[var(--surface-primary)]">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">AI 초기 분석 결과</h4>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          내부 분석용 — 확정 전까지 초안 상태
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {PIPELINE_TASK_KEYS.map((key) => {
          const status = pipeline.tasks[key];
          const preview = pipeline.taskPreviews[key];
          const isCompleted = status === "completed";
          const isFailed = status === "failed";
          const isChecked = checkedTasks.has(key);

          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-xs",
                isCompleted && "bg-emerald-50/50 dark:bg-emerald-950/10",
                isFailed && "bg-red-50/50 dark:bg-red-950/10",
              )}
            >
              {isCompleted && (
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCheck(key)}
                  className="h-3.5 w-3.5 rounded"
                />
              )}
              {isFailed && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />}

              <span className={cn(
                "flex-1",
                isFailed ? "text-red-600 dark:text-red-400" : "text-[var(--text-primary)]",
              )}>
                {PIPELINE_TASK_LABELS[key]}
                {preview && (
                  <span className="text-[var(--text-tertiary)]"> — {preview}</span>
                )}
                {isFailed && pipeline.errorDetails?.[key] && (
                  <span className="text-red-400"> ({pipeline.errorDetails[key]})</span>
                )}
              </span>

              {isCompleted && (
                <button
                  type="button"
                  onClick={() => scrollToSection(key)}
                  className="shrink-0 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                  title="보기"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              {isFailed && (
                <button
                  type="button"
                  onClick={() => scrollToSection(key)}
                  className="shrink-0 text-[10px] font-medium text-red-600 hover:text-red-800 dark:text-red-400"
                >
                  재시도
                </button>
              )}
            </div>
          );
        })}
      </div>

      {completedTasks.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border-secondary)] pt-3">
          {/* 역량 분석 완료 시 종합진단 연계 CTA */}
          {pipeline.tasks.competency_analysis === "completed" && (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 dark:bg-blue-900/10">
              <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              <span className="flex-1 text-xs text-blue-700 dark:text-blue-400">
                역량 분석이 완료되었습니다. 종합진단을 생성하세요.
              </span>
              <button
                type="button"
                onClick={() => document.getElementById("sec-diagnosis-overall")?.scrollIntoView({ behavior: "smooth" })}
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-800/30"
              >
                종합진단으로 이동
              </button>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {checkedTasks.size}개 선택됨
            </span>
            <button
              type="button"
              onClick={() => {
                const firstSection = SECTION_SCROLL_MAP[completedTasks[0]];
                document.getElementById(firstSection)?.scrollIntoView({ behavior: "smooth" });
              }}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              선택 항목 리뷰
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
