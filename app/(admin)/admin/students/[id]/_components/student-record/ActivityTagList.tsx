"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import {
  addActivityTagAction,
  deleteActivityTagAction,
  confirmActivityTagAction,
} from "@/lib/domains/student-record/actions/diagnosis";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record";
import type { ActivityTag, CompetencyItemCode, TagEvaluation } from "@/lib/domains/student-record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { Check, Trash2, Plus } from "lucide-react";

type Props = {
  tags: ActivityTag[];
  studentId: string;
  tenantId: string;
  schoolYear: number;
};

const RECORD_TYPE_LABELS: Record<string, string> = {
  setek: "세특",
  personal_setek: "개인세특",
  changche: "창체",
  haengteuk: "행특",
};

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  ai: { label: "AI", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  manual: { label: "수동", cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  suggested: { label: "제안", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  confirmed: { label: "확정", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

const EVAL_BADGE: Record<string, { label: string; cls: string }> = {
  positive: { label: "긍정", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  negative: { label: "부정", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  needs_review: { label: "확인필요", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
};

function getItemLabel(code: string): string {
  return COMPETENCY_ITEMS.find((i) => i.code === code)?.label ?? code;
}

export function ActivityTagList({ tags, studentId, tenantId, schoolYear }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();

  const filtered = filter === "all" ? tags : tags.filter((t) => t.record_type === filter);

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await confirmActivityTagAction(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear) }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteActivityTagAction(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear) }),
  });

  const addMutation = useMutation({
    mutationFn: async (input: { competencyItem: CompetencyItemCode; evaluation: TagEvaluation; evidenceSummary: string }) => {
      const result = await addActivityTagAction({
        tenant_id: tenantId,
        student_id: studentId,
        record_type: "setek",
        record_id: "00000000-0000-0000-0000-000000000000", // 수동 추가 시 placeholder
        competency_item: input.competencyItem,
        evaluation: input.evaluation,
        evidence_summary: input.evidenceSummary || null,
        source: "manual",
        status: "confirmed",
      });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear) });
      setShowAddForm(false);
    },
  });

  // 통계
  const suggestedCount = tags.filter((t) => t.status === "suggested").length;
  const confirmedCount = tags.filter((t) => t.status === "confirmed").length;

  return (
    <div className="flex flex-col gap-3">
      {/* 요약 + 필터 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 text-xs">
          <span className="text-[var(--text-tertiary)]">전체 {tags.length}개</span>
          {suggestedCount > 0 && <span className="text-yellow-600">제안 {suggestedCount}</span>}
          <span className="text-green-600">확정 {confirmedCount}</span>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border border-gray-300 bg-[var(--background)] px-2 py-1 text-xs dark:border-gray-600"
        >
          <option value="all">전체</option>
          {Object.entries(RECORD_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* 태그 목록 */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-600">
          활동 태그가 없습니다. 세특/창체 에디터에서 AI 태그 제안을 사용하거나 수동으로 추가하세요.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((tag) => {
            const src = SOURCE_BADGE[tag.source] ?? SOURCE_BADGE.manual;
            const sts = STATUS_BADGE[tag.status] ?? STATUS_BADGE.confirmed;
            const ev = EVAL_BADGE[tag.evaluation] ?? EVAL_BADGE.positive;

            return (
              <div key={tag.id} className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", src.cls)}>{src.label}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", sts.cls)}>{sts.label}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", ev.cls)}>{ev.label}</span>
                    <span className="text-xs font-medium text-[var(--text-primary)]">{getItemLabel(tag.competency_item)}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{RECORD_TYPE_LABELS[tag.record_type] ?? tag.record_type}</span>
                  </div>
                  {tag.evidence_summary && (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{tag.evidence_summary}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {tag.status === "suggested" && (
                    <button
                      onClick={() => confirmMutation.mutate(tag.id)}
                      disabled={confirmMutation.isPending}
                      className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                      title="확정"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(tag.id); }}
                    disabled={deleteMutation.isPending}
                    className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 수동 추가 */}
      {showAddForm ? (
        <ManualTagForm
          onSubmit={(data) => addMutation.mutate(data)}
          onCancel={() => setShowAddForm(false)}
          isPending={addMutation.isPending}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 self-start rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-[var(--text-tertiary)] hover:border-gray-400 hover:text-[var(--text-secondary)] dark:border-gray-600"
        >
          <Plus size={12} /> 수동 태그 추가
        </button>
      )}
    </div>
  );
}

function ManualTagForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (data: { competencyItem: CompetencyItemCode; evaluation: TagEvaluation; evidenceSummary: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [item, setItem] = useState<CompetencyItemCode>("academic_achievement");
  const [evaluation, setEvaluation] = useState<TagEvaluation>("positive");
  const [evidence, setEvidence] = useState("");

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex gap-2">
        <select
          value={item}
          onChange={(e) => setItem(e.target.value as CompetencyItemCode)}
          className="flex-1 rounded border border-gray-300 bg-[var(--background)] px-2 py-1 text-xs dark:border-gray-600"
        >
          {COMPETENCY_ITEMS.map((i) => (
            <option key={i.code} value={i.code}>{COMPETENCY_AREA_LABELS[i.area]} - {i.label}</option>
          ))}
        </select>
        <select
          value={evaluation}
          onChange={(e) => setEvaluation(e.target.value as TagEvaluation)}
          className="w-24 rounded border border-gray-300 bg-[var(--background)] px-2 py-1 text-xs dark:border-gray-600"
        >
          <option value="positive">긍정</option>
          <option value="negative">부정</option>
          <option value="needs_review">확인필요</option>
        </select>
      </div>
      <input
        type="text"
        value={evidence}
        onChange={(e) => setEvidence(e.target.value)}
        placeholder="근거 요약 (선택)"
        className="rounded border border-gray-300 bg-[var(--background)] px-2 py-1.5 text-xs dark:border-gray-600"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit({ competencyItem: item, evaluation, evidenceSummary: evidence })}
          disabled={isPending}
          className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          추가
        </button>
        <button onClick={onCancel} className="rounded border border-gray-300 px-3 py-1 text-xs dark:border-gray-600">
          취소
        </button>
      </div>
    </div>
  );
}
