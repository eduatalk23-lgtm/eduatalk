"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Eye, Pencil } from "lucide-react";
import { removeRoadmapItemAction } from "@/lib/domains/student-record/actions/storyline";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { RoadmapItem, Storyline, RoadmapItemStatus } from "@/lib/domains/student-record";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import { AreaCoverageSummary, RoadmapReadOnlyRow, RoadmapItemRow, AREA_OPTIONS } from "./RoadmapItemRows";
import { AddRoadmapForm } from "./AddRoadmapForm";

type RoadmapEditorProps = {
  roadmapItems: RoadmapItem[];
  storylines: Storyline[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
};

export function RoadmapEditor({
  roadmapItems,
  storylines,
  studentId,
  schoolYear,
  tenantId,
  grade,
}: RoadmapEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();
  const { showSuccess } = useToast();

  // AI 생성 항목 수 + 모드 감지 (상단에서 먼저 계산)
  const aiItems = roadmapItems.filter((r) => r.plan_content.startsWith("[AI]"));
  const hasAiItems = aiItems.length > 0;
  const [viewMode, setViewMode] = useState<"ai_readonly" | "edit">(hasAiItems ? "ai_readonly" : "edit");

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await removeRoadmapItemAction(id);
      if (!result.success) throw new Error("error" in result ? result.error : "삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.storylineTab(studentId) });
    },
  });

  // AI 로드맵 생성
  const generateMutation = useMutation({
    mutationFn: async () => {
      const { generateAiRoadmap } = await import(
        "@/lib/domains/student-record/llm/actions/generateRoadmap"
      );
      const result = await generateAiRoadmap(studentId);
      if (!result.success) throw new Error("error" in result ? result.error : "생성 실패");
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.storylineTab(studentId) });
      showSuccess(`AI 로드맵 ${data?.items?.length ?? 0}건 생성 완료`);
    },
  });

  // Group by grade
  const grades = [1, 2, 3];
  const itemsByGrade = grades.map((g) => roadmapItems.filter((item) => item.grade === g));

  return (
    <div className="flex flex-col gap-4">
      {/* AI 로드맵 생성 + 상태 표시 + 뷰 모드 토글 */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* 뷰 모드 토글 (AI 항목 있을 때만) */}
          {hasAiItems && (
            <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setViewMode("ai_readonly")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-l-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  viewMode === "ai_readonly"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                    : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]",
                )}
              >
                <Eye className="h-3 w-3" />
                AI 제안
              </button>
              <button
                type="button"
                onClick={() => setViewMode("edit")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-r-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  viewMode === "edit"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                    : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]",
                )}
              >
                <Pencil className="h-3 w-3" />
                편집
              </button>
            </div>
          )}
          {hasAiItems && (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-900/20 dark:text-violet-400">
                <Sparkles className="h-3 w-3" />
                AI 추천 {aiItems.length}건
              </span>
              {(() => {
                const allKw = aiItems.flatMap((r) => r.plan_keywords ?? []);
                const freq = new Map<string, number>();
                for (const kw of allKw) freq.set(kw, (freq.get(kw) ?? 0) + 1);
                const topKw = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
                if (topKw.length === 0) return null;
                return (
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    핵심 키워드: {topKw.map(([kw]) => kw).join(", ")}
                  </span>
                );
              })()}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (hasAiItems && !confirm("기존 AI 로드맵을 대체합니다. 계속하시겠습니까?")) return;
            generateMutation.mutate();
          }}
          disabled={generateMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          AI 로드맵 생성
        </button>
      </div>

      {generateMutation.isError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {generateMutation.error?.message ?? "로드맵 생성에 실패했습니다."}
        </div>
      )}

      {/* 영역별 커버리지 요약 (AI 제안 모드) */}
      {viewMode === "ai_readonly" && hasAiItems && (
        <AreaCoverageSummary items={roadmapItems} />
      )}

      {/* 학년별 그리드 */}
      {grades.map((g, idx) => (
        <div key={g} className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
            <span className="text-sm font-medium text-[var(--text-primary)]">{g}학년 로드맵</span>
            <span className="ml-2 text-xs text-[var(--text-tertiary)]">({itemsByGrade[idx].length}개)</span>
          </div>

          {itemsByGrade[idx].length > 0 ? (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {itemsByGrade[idx].map((item) =>
                viewMode === "ai_readonly" ? (
                  <RoadmapReadOnlyRow key={item.id} item={item} storylines={storylines} />
                ) : (
                  <RoadmapItemRow
                    key={item.id}
                    item={item}
                    storylines={storylines}
                    studentId={studentId}
                    onDelete={() => {
                      if (confirm("이 로드맵 항목을 삭제하시겠습니까?")) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                  />
                ),
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-[var(--text-placeholder)]">
              {g}학년 로드맵 항목이 없습니다.
            </div>
          )}
        </div>
      ))}

      {/* 추가 폼 (편집 모드에서만) */}
      {viewMode === "edit" && showAddForm ? (
        <AddRoadmapForm
          studentId={studentId}
          schoolYear={schoolYear}
          tenantId={tenantId}
          grade={grade}
          storylines={storylines}
          sortOrder={roadmapItems.length}
          onClose={() => setShowAddForm(false)}
        />
      ) : viewMode === "edit" ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-[var(--text-tertiary)] transition hover:border-gray-400 hover:text-[var(--text-secondary)] dark:border-gray-600 dark:hover:border-gray-500"
        >
          + 로드맵 항목 추가
        </button>
      ) : null}
    </div>
  );
}

