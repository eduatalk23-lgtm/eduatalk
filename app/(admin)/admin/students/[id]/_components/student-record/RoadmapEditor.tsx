"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Tag, Eye, Pencil } from "lucide-react";
import {
  saveRoadmapItemAction,
  updateRoadmapItemAction,
  removeRoadmapItemAction,
} from "@/lib/domains/student-record/actions/storyline";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { RoadmapItem, Storyline, RoadmapArea, RoadmapItemStatus } from "@/lib/domains/student-record";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import { SaveStatusIndicator } from "./SaveStatusIndicator";

const STATUS_CONFIG: Record<RoadmapItemStatus, { label: string; className: string }> = {
  planning: { label: "계획", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  confirmed: { label: "확정", className: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  in_progress: { label: "진행중", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  completed: { label: "완료", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

const AREA_OPTIONS: { value: RoadmapArea; label: string }[] = [
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
  const { showError, showSuccess } = useToast();

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

// ============================================
// AreaCoverageSummary — 영역별 커버리지 요약
// ============================================

function AreaCoverageSummary({ items }: { items: RoadmapItem[] }) {
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

function RoadmapReadOnlyRow({
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

function RoadmapItemRow({
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

// ============================================
// AddRoadmapForm
// ============================================

function AddRoadmapForm({
  studentId,
  schoolYear,
  tenantId,
  grade,
  storylines,
  sortOrder,
  onClose,
}: {
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  storylines: Storyline[];
  sortOrder: number;
  onClose: () => void;
}) {
  const [area, setArea] = useState<string>("setek");
  const [targetGrade, setTargetGrade] = useState(grade);
  const [semester, setSemester] = useState<number | null>(null);
  const [planContent, setPlanContent] = useState("");
  const [storylineId, setStorylineId] = useState<string>("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!planContent.trim()) throw new Error("계획 내용을 입력해주세요.");
      const result = await saveRoadmapItemAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade: targetGrade,
        semester,
        area,
        plan_content: planContent.trim(),
        storyline_id: storylineId || null,
        sort_order: sortOrder,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "저장 실패");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.storylineTab(studentId) });
      onClose();
    },
  });

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">로드맵 항목 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">취소</button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {AREA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={targetGrade}
            onChange={(e) => setTargetGrade(Number(e.target.value))}
            className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value={1}>1학년</option>
            <option value={2}>2학년</option>
            <option value={3}>3학년</option>
          </select>
          <select
            value={semester ?? ""}
            onChange={(e) => setSemester(e.target.value ? Number(e.target.value) : null)}
            className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">학기 미지정</option>
            <option value={1}>1학기</option>
            <option value={2}>2학기</option>
          </select>
          <select
            value={storylineId}
            onChange={(e) => setStorylineId(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">스토리라인 미연결</option>
            {storylines.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        <textarea
          value={planContent}
          onChange={(e) => setPlanContent(e.target.value)}
          rows={2}
          placeholder="계획 내용을 입력하세요... *"
          className="w-full resize-y rounded-md border border-gray-200 bg-white p-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
        />

        <div className="flex justify-end">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? "추가 중..." : "추가"}
          </button>
        </div>
        {mutation.isError && <p className="text-xs text-red-600">{mutation.error.message}</p>}
      </div>
    </div>
  );
}
