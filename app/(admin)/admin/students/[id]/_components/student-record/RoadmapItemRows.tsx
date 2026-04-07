"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Tag } from "lucide-react";
import { updateRoadmapItemAction } from "@/lib/domains/student-record/actions/storyline";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { RoadmapItem, Storyline, RoadmapArea, RoadmapItemStatus } from "@/lib/domains/student-record";
import { cn } from "@/lib/cn";
import { SaveStatusIndicator } from "./SaveStatusIndicator";

export const AREA_OPTIONS: { value: RoadmapArea; label: string }[] = [
  { value: "autonomy", label: "자율·자치" },
  { value: "club", label: "동아리" },
  { value: "career", label: "진로" },
  { value: "setek", label: "세특" },
  { value: "personal_setek", label: "개인세특" },
  { value: "reading", label: "독서" },
  { value: "course_selection", label: "교과선택" },
  { value: "competition", label: "대회" },
  { value: "external", label: "외부활동" },
  { value: "volunteer", label: "봉사" },
  { value: "general", label: "기타" },
];

export const STATUS_CONFIG: Record<RoadmapItemStatus, { label: string; className: string }> = {
  planning: { label: "계획", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  confirmed: { label: "확정", className: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "진행중", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  completed: { label: "완료", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

// ============================================
// AreaCoverageSummary — 영역별 커버리지 요약
// ============================================

export function AreaCoverageSummary({ items }: { items: RoadmapItem[] }) {
  const coverage = useMemo(() => {
    const map: Record<number, Record<string, number>> = { 1: {}, 2: {}, 3: {} };
    for (const item of items) {
      if (!map[item.grade]) map[item.grade] = {};
      map[item.grade][item.area] = (map[item.grade][item.area] ?? 0) + 1;
    }
    return map;
  }, [items]);

  const activeAreas = useMemo(() => {
    const areas = new Set<string>();
    for (const item of items) areas.add(item.area);
    return AREA_OPTIONS.filter((a) => areas.has(a.value));
  }, [items]);

  if (activeAreas.length === 0) return null;

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <p className="mb-2 text-[11px] font-medium text-violet-700 dark:text-violet-400">영역별 커버리지</p>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-[var(--text-tertiary)]">
              <th className="py-1 text-left font-medium">영역</th>
              {[1, 2, 3].map((g) => (
                <th key={g} className="py-1 text-center font-medium">{g}학년</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeAreas.map(({ value, label }) => (
              <tr key={value} className="border-t border-violet-100 dark:border-violet-800/50">
                <td className="py-1 text-[var(--text-secondary)]">{label}</td>
                {[1, 2, 3].map((g) => {
                  const count = coverage[g]?.[value] ?? 0;
                  return (
                    <td key={g} className="py-1 text-center">
                      {count > 0 ? (
                        <span className="inline-block min-w-[1.25rem] rounded-full bg-violet-200 px-1 text-[10px] font-bold text-violet-700 dark:bg-violet-800 dark:text-violet-300">
                          {count}
                        </span>
                      ) : (
                        <span className="text-[var(--text-placeholder)]">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// RoadmapReadOnlyRow — AI 제안 읽기 전용
// ============================================

export function RoadmapReadOnlyRow({
  item,
  storylines,
}: {
  item: RoadmapItem;
  storylines: Storyline[];
}) {
  const isAi = item.plan_content.startsWith("[AI]");
  const displayContent = isAi ? item.plan_content.replace(/^\[AI\]\s*/, "") : item.plan_content;
  const areaLabel = AREA_OPTIONS.find((a) => a.value === item.area)?.label ?? item.area;
  const linkedStoryline = item.storyline_id
    ? storylines.find((s) => s.id === item.storyline_id)
    : null;
  const itemStatus = (item.status as RoadmapItemStatus) ?? "planning";
  const statusCfg = STATUS_CONFIG[itemStatus];

  return (
    <div className={cn("p-3", isAi && "bg-violet-50/40 dark:bg-violet-900/10")}>
      <div className="flex flex-wrap items-center gap-2">
        {isAi && (
          <span className="inline-flex items-center gap-0.5 text-violet-500">
            <Sparkles className="h-3 w-3" />
          </span>
        )}
        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
          {areaLabel}
        </span>
        <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", statusCfg.className)}>
          {statusCfg.label}
        </span>
        {item.semester && (
          <span className="text-xs text-[var(--text-tertiary)]">{item.semester}학기</span>
        )}
        {linkedStoryline && (
          <span className="text-xs text-[var(--text-tertiary)]">→ {linkedStoryline.title}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-[var(--text-primary)]">{displayContent}</p>
      {isAi && item.plan_keywords && item.plan_keywords.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {item.plan_keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
            >
              <Tag className="h-2 w-2" />
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// RoadmapItemRow — 개별 로드맵 항목 행 (편집 모드)
// ============================================

export function RoadmapItemRow({
  item,
  storylines,
  studentId,
  onDelete,
}: {
  item: RoadmapItem;
  storylines: Storyline[];
  studentId: string;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [executionContent, setExecutionContent] = useState(item.execution_content ?? "");
  const [matchRate, setMatchRate] = useState(item.match_rate ?? 0);
  const [deviationNote, setDeviationNote] = useState(item.deviation_note ?? "");
  const queryClient = useQueryClient();

  const executionMutation = useMutation({
    mutationFn: async () => {
      const execKeywords = executionContent
        ? executionContent.split(/[,\s]+/).filter(Boolean).slice(0, 5)
        : null;

      // U3: plan_keywords ↔ execution_keywords Jaccard 자동 계산
      let autoMatchRate = matchRate;
      if (execKeywords && execKeywords.length > 0 && item.plan_keywords && item.plan_keywords.length > 0) {
        const planSet = new Set(item.plan_keywords.map((k) => k.toLowerCase()));
        const execSet = new Set(execKeywords.map((k) => k.toLowerCase()));
        const intersection = [...planSet].filter((k) => execSet.has(k)).length;
        const union = new Set([...planSet, ...execSet]).size;
        autoMatchRate = union > 0 ? Math.round((intersection / union) * 100) : 0;
      }

      const result = await updateRoadmapItemAction(item.id, {
        execution_content: executionContent || null,
        execution_keywords: execKeywords,
        executed_at: executionContent ? new Date().toISOString() : null,
        match_rate: autoMatchRate,
        deviation_note: deviationNote || null,
        status: executionContent ? "completed" : undefined,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "수정 실패");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.storylineTab(studentId) });
      setIsEditing(false);
    },
  });

  const linkedStoryline = item.storyline_id
    ? storylines.find((s) => s.id === item.storyline_id)
    : null;

  const isAi = item.plan_content.startsWith("[AI]");
  const displayContent = isAi ? item.plan_content.replace(/^\[AI\]\s*/, "") : item.plan_content;
  const areaLabel = AREA_OPTIONS.find((a) => a.value === item.area)?.label ?? item.area;
  const hasExecution = !!item.execution_content;
  const itemStatus = (item.status as RoadmapItemStatus) ?? (hasExecution ? "completed" : "planning");
  const statusCfg = STATUS_CONFIG[itemStatus];

  const saveStatus = executionMutation.isPending
    ? ("saving" as const)
    : executionMutation.isSuccess
      ? ("saved" as const)
      : executionMutation.isError
        ? ("error" as const)
        : ("idle" as const);

  return (
    <div className={cn("p-3", isAi && "bg-violet-50/40 dark:bg-violet-900/10")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isAi && (
              <span className="inline-flex items-center gap-0.5 text-violet-500">
                <Sparkles className="h-3 w-3" />
              </span>
            )}
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              {areaLabel}
            </span>
            <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", statusCfg.className)}>
              {statusCfg.label}
            </span>
            {item.semester && (
              <span className="text-xs text-[var(--text-tertiary)]">{item.semester}학기</span>
            )}
            {linkedStoryline && (
              <span className="text-xs text-[var(--text-tertiary)]">
                → {linkedStoryline.title}
              </span>
            )}
            {item.match_rate != null && (
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-xs font-medium",
                item.match_rate >= 70
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
              )}>
                {item.match_rate}%
              </span>
            )}
          </div>

          {/* 계획 */}
          <p className="mt-1 text-sm text-[var(--text-primary)]">{displayContent}</p>

          {/* AI 키워드 태그 */}
          {isAi && item.plan_keywords && item.plan_keywords.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.plan_keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
                >
                  <Tag className="h-2 w-2" />
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* 실행 결과 */}
          {hasExecution && !isEditing && (
            <div className="mt-2 rounded bg-emerald-50/50 p-2 dark:bg-emerald-900/10">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                <span className="font-medium">실행:</span> {item.execution_content}
              </p>
              {item.deviation_note && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  <span className="font-medium">편차:</span> {item.deviation_note}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            {isEditing ? "취소" : "실행기록"}
          </button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">삭제</button>
        </div>
      </div>

      {/* 실행 기록 편집 */}
      {isEditing && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-2">
            <textarea
              value={executionContent}
              onChange={(e) => setExecutionContent(e.target.value)}
              rows={2}
              placeholder="실행 내용을 입력하세요..."
              className="w-full resize-y rounded-md border border-gray-200 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
            <div className="flex gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--text-secondary)]">일치율</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={matchRate}
                  onChange={(e) => setMatchRate(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-16 rounded-md border border-gray-200 px-2 py-1 text-center text-sm dark:border-gray-600 dark:bg-gray-900"
                />
                <span className="text-xs text-[var(--text-tertiary)]">%</span>
              </div>
            </div>
            <input
              value={deviationNote}
              onChange={(e) => setDeviationNote(e.target.value)}
              placeholder="편차 사유 (선택)"
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
            <div className="flex items-center justify-between">
              <SaveStatusIndicator
                status={saveStatus}
                error={executionMutation.isError ? executionMutation.error.message : undefined}
              />
              <button
                onClick={() => executionMutation.mutate()}
                disabled={executionMutation.isPending}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {executionMutation.isPending ? "저장 중..." : "실행 기록 저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
