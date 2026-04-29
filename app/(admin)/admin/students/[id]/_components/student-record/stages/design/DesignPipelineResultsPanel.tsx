"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { pipelineStatusQueryOptions } from "@/lib/query-options/studentRecord";
import {
  PIPELINE_TASK_KEYS,
  PIPELINE_TASK_LABELS,
} from "@/lib/domains/record-analysis/pipeline/pipeline-config";
import type { PipelineTaskKey } from "@/lib/domains/record-analysis/pipeline/pipeline-types";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import { cn } from "@/lib/cn";
import { Check, AlertCircle, ChevronRight, Circle } from "lucide-react";

/** P2-2: 태스크 결과에서 관련 역량 항목 추출 */
function extractTaskCompetencies(
  key: PipelineTaskKey,
  taskResults: Record<string, unknown> | null,
  preview: string | undefined,
): string[] {
  if (!taskResults) return [];
  const result = taskResults[key] as Record<string, unknown> | undefined;

  // competency_analysis: 결과에 totalEdges나 preview에서 추출
  if (key === "competency_analysis" && preview) {
    // preview: "12건 성공 (세특+창체+행특)" → 역량 전체 관련
    return [];
  }

  // setek_guide: guides[].competencyFocus
  if (key === "setek_guide" && Array.isArray(result?.guides)) {
    const codes = new Set<string>();
    for (const g of result.guides as Array<{ competencyFocus?: string[] }>) {
      for (const c of g.competencyFocus ?? []) codes.add(c);
    }
    return [...codes].slice(0, 4);
  }

  // ai_strategy: strategies target_area에서 역량 영역 추론
  if (key === "ai_strategy" && Array.isArray(result?.suggestions)) {
    const areas = new Set<string>();
    for (const s of result.suggestions as Array<{ targetArea?: string }>) {
      if (s.targetArea) areas.add(s.targetArea);
    }
    return [...areas].slice(0, 3);
  }

  // edge_computation: nodeCount에서 영역 수 표시
  if (key === "edge_computation" && result?.totalEdges) {
    return []; // 엣지는 역량 항목보다 영역 수가 의미 있음
  }

  return [];
}

interface DesignPipelineResultsPanelProps {
  studentId: string;
  tenantId: string;
}

const SECTION_SCROLL_MAP: Record<PipelineTaskKey, string> = {
  competency_analysis: "sec-diagnosis-analysis",
  edge_computation: "sec-cross-reference",
  ai_diagnosis: "sec-diagnosis-overall",
  storyline_generation: "sec-storyline",
  course_recommendation: "sec-course-plan",
  guide_matching: "sec-exploration-guide",
  bypass_analysis: "sec-bypass-major",
  setek_guide: "sec-setek-guide",
  activity_summary: "sec-activity-summary",
  ai_strategy: "sec-compensation",
  interview_generation: "sec-interview",
  roadmap_generation: "sec-roadmap",
};

export function DesignPipelineResultsPanel({
  studentId,
  tenantId,
}: DesignPipelineResultsPanelProps) {
  const queryClient = useQueryClient();
  const pollingStartRef = useRef<number | null>(null);

  const { data: pipeline } = useQuery({
    ...pipelineStatusQueryOptions(studentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status !== "running") {
        pollingStartRef.current = null;
        return false;
      }
      if (!pollingStartRef.current) pollingStartRef.current = Date.now();
      const elapsed = Date.now() - pollingStartRef.current;
      // 백오프: 첫 2분은 3초, 이후 10초.
      return elapsed > 120_000 ? 10_000 : 3000;
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
  const pendingTasks = PIPELINE_TASK_KEYS.filter(
    (k) => pipeline.tasks[k] === "pending",
  );
  const hasUnexecutedTasks = pendingTasks.length > 0 && pipeline.status !== "running";

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

  // W-4: 미니 대시보드 데이터 추출
  const taskResults = pipeline.taskResults ?? {};
  const edgeResult = taskResults.edge_computation as { totalEdges?: number; nodeCount?: number } | undefined;
  const diagnosisPreview = pipeline.taskPreviews?.ai_diagnosis;
  const strategyPreview = pipeline.taskPreviews?.ai_strategy;

  return (
    <div className="rounded-lg border border-[var(--border-secondary)] bg-white p-4 dark:bg-[var(--surface-primary)]">
      {/* W-4: 미니 대시보드 (완료 시만) */}
      {(pipeline.status === "completed" || pipeline.status === "failed") && completedTasks.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-2 text-center dark:border-indigo-800 dark:bg-indigo-950/20">
            <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
              {completedTasks.length}/{PIPELINE_TASK_KEYS.length}
            </p>
            <p className="text-3xs text-indigo-600 dark:text-indigo-400">태스크 완료</p>
          </div>
          <div className="rounded-lg border border-teal-200 bg-teal-50/50 px-3 py-2 text-center dark:border-teal-800 dark:bg-teal-950/20">
            <p className="text-lg font-bold text-teal-700 dark:text-teal-300">
              {edgeResult?.totalEdges ?? "-"}
            </p>
            <p className="text-3xs text-teal-600 dark:text-teal-400">엣지 감지</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-center dark:border-amber-800 dark:bg-amber-950/20">
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
              {strategyPreview?.match(/(\d+)건/)?.[1] ?? "-"}
            </p>
            <p className="text-3xs text-amber-600 dark:text-amber-400">전략 제안</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">AI 초기 분석 결과</h4>
        {pipeline.status === "failed" ? (
          <span className="text-3xs text-amber-600 dark:text-amber-400">
            사이드바 파이프라인 패널에서 재실행하세요
          </span>
        ) : (
          <span className="text-3xs text-[var(--text-tertiary)]">
            내부 분석용 — 확정 전까지 초안 상태
          </span>
        )}
      </div>

      {/* 미실행 태스크가 있는 경우 재분석 안내 */}
      {hasUnexecutedTasks && pipeline.status === "completed" && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/20">
          <span className="text-xs text-amber-700 dark:text-amber-300">
            {pendingTasks.length}개 태스크가 실행되지 않았습니다
          </span>
          <span className="text-3xs text-amber-600 dark:text-amber-400">
            사이드바에서 재분석을 실행하세요
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1.5">
        {PIPELINE_TASK_KEYS.map((key) => {
          const status = pipeline.tasks[key];
          const preview = pipeline.taskPreviews[key];
          const isCompleted = status === "completed";
          const isFailed = status === "failed";
          const isPending = status === "pending";
          const isChecked = checkedTasks.has(key);

          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-xs",
                isCompleted && "bg-emerald-50/50 dark:bg-emerald-950/10",
                isFailed && "bg-red-50/50 dark:bg-red-950/10",
                isPending && "bg-bg-secondary/50 dark:bg-gray-950/10",
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
              {isPending && <Circle className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] opacity-40" />}

              <span className={cn(
                "flex-1",
                isFailed ? "text-red-600 dark:text-red-400" : isPending ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]",
              )}>
                {PIPELINE_TASK_LABELS[key]}
                {preview && (
                  <span className="text-[var(--text-tertiary)]"> — {preview}</span>
                )}
                {isPending && (
                  <span className="ml-1.5 rounded bg-bg-tertiary px-1 py-0.5 text-3xs font-medium text-text-tertiary dark:bg-bg-secondary dark:text-text-tertiary">
                    미실행
                  </span>
                )}
                {isFailed && pipeline.errorDetails?.[key] && (
                  <span className="text-red-400"> ({pipeline.errorDetails[key]})</span>
                )}
                {/* P2-2: 역량 연결 배지 */}
                {isCompleted && (() => {
                  const codes = extractTaskCompetencies(key, pipeline.taskResults, preview);
                  if (codes.length === 0) return null;
                  return (
                    <span className="ml-1.5 inline-flex gap-0.5">
                      {codes.map((code) => {
                        const item = COMPETENCY_ITEMS.find((i) => i.code === code);
                        return (
                          <span key={code} className="rounded bg-violet-100 px-1 py-0.5 text-3xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                            {item?.label ?? code}
                          </span>
                        );
                      })}
                    </span>
                  );
                })()}
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
                <span className="shrink-0 text-3xs text-[var(--text-tertiary)]">
                  사이드바에서 재실행
                </span>
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
            <span className="text-3xs text-[var(--text-tertiary)]">
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

      {/* F6: 파이프라인 완료 후 우회학과 분석 CTA */}
      {completedTasks.length === PIPELINE_TASK_KEYS.length && (
        <button
          type="button"
          onClick={() => {
            document.getElementById("sec-bypass-major")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-left transition-colors hover:bg-amber-50 dark:border-amber-800 dark:bg-amber-950/10 dark:hover:bg-amber-950/20"
        >
          <div>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              우회학과 분석도 실행하시겠습니까?
            </p>
            <p className="text-3xs text-amber-600 dark:text-amber-400">
              목표 전공 대비 교차지원 가능한 학과를 탐색합니다
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-amber-600" />
        </button>
      )}
    </div>
  );
}
