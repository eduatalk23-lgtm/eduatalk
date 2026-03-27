"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveRoadmapItemAction,
  updateRoadmapItemAction,
  removeRoadmapItemAction,
} from "@/lib/domains/student-record/actions/storyline";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { RoadmapItem, Storyline, RoadmapArea, RoadmapItemStatus } from "@/lib/domains/student-record";
import { cn } from "@/lib/cn";
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await removeRoadmapItemAction(id);
      if (!result.success) throw new Error("error" in result ? result.error : "삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.storylineTab(studentId) });
    },
  });

  // Group by grade
  const grades = [1, 2, 3];
  const itemsByGrade = grades.map((g) => roadmapItems.filter((item) => item.grade === g));

  return (
    <div className="flex flex-col gap-4">
      {/* 학년별 그리드 */}
      {grades.map((g, idx) => (
        <div key={g} className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
            <span className="text-sm font-medium text-[var(--text-primary)]">{g}학년 로드맵</span>
            <span className="ml-2 text-xs text-[var(--text-tertiary)]">({itemsByGrade[idx].length}개)</span>
          </div>

          {itemsByGrade[idx].length > 0 ? (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {itemsByGrade[idx].map((item) => (
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
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-[var(--text-placeholder)]">
              {g}학년 로드맵 항목이 없습니다.
            </div>
          )}
        </div>
      ))}

      {/* 추가 폼 */}
      {showAddForm ? (
        <AddRoadmapForm
          studentId={studentId}
          schoolYear={schoolYear}
          tenantId={tenantId}
          grade={grade}
          storylines={storylines}
          sortOrder={roadmapItems.length}
          onClose={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-[var(--text-tertiary)] transition hover:border-gray-400 hover:text-[var(--text-secondary)] dark:border-gray-600 dark:hover:border-gray-500"
        >
          + 로드맵 항목 추가
        </button>
      )}
    </div>
  );
}

// ============================================
// RoadmapItemRow — 개별 로드맵 항목 행
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
      const result = await updateRoadmapItemAction(item.id, {
        execution_content: executionContent || null,
        execution_keywords: executionContent
          ? executionContent.split(/[,\s]+/).filter(Boolean).slice(0, 5)
          : null,
        executed_at: executionContent ? new Date().toISOString() : null,
        match_rate: matchRate,
        deviation_note: deviationNote || null,
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
    <div className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
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
          <p className="mt-1 text-sm text-[var(--text-primary)]">{item.plan_content}</p>

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
