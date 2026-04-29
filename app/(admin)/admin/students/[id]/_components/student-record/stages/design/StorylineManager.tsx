"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveStorylineAction,
  updateStorylineAction,
  removeStorylineAction,
} from "@/lib/domains/student-record/actions/storyline";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { Storyline } from "@/lib/domains/student-record";
import { StorylineStrengthBadge } from "../../StorylineStrengthBadge";
import { SaveStatusIndicator } from "../../SaveStatusIndicator";
import { useAutoSave } from "../../useAutoSave";

type StorylineManagerProps = {
  storylines: Storyline[];
  studentId: string;
  tenantId: string;
};

export function StorylineManager({
  storylines,
  studentId,
  tenantId,
}: StorylineManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await removeStorylineAction(id);
      if (!result.success) throw new Error("error" in result ? result.error : "삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.storylineTab(studentId) });
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {storylines.length === 0 && !showAddForm && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-[var(--text-tertiary)] dark:border-border">
          등록된 스토리라인이 없습니다. 학생의 3년간 성장 서사를 추가해주세요.
        </div>
      )}

      {storylines.map((s) => (
        <StorylineCard
          key={s.id}
          storyline={s}
          studentId={studentId}
          isExpanded={expandedId === s.id}
          onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
          onDelete={() => {
            if (confirm(`"${s.title}" 스토리라인을 삭제하시겠습니까?\n연결된 활동도 모두 해제됩니다.`)) {
              deleteMutation.mutate(s.id);
            }
          }}
        />
      ))}

      {showAddForm ? (
        <AddStorylineForm
          studentId={studentId}
          tenantId={tenantId}
          sortOrder={storylines.length}
          onClose={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg border border-dashed border-border p-3 text-sm text-[var(--text-tertiary)] transition hover:border-gray-400 hover:text-[var(--text-secondary)] dark:border-border dark:hover:border-gray-500"
        >
          + 스토리라인 추가
        </button>
      )}
    </div>
  );
}

// ============================================
// StorylineCard — 개별 스토리라인 편집 카드
// ============================================

function StorylineCard({
  storyline,
  studentId,
  isExpanded,
  onToggle,
  onDelete,
}: {
  storyline: Storyline;
  studentId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(storyline.title);
  const [careerField, setCareerField] = useState(storyline.career_field ?? "");
  const [keywords, setKeywords] = useState((storyline.keywords ?? []).join(", "));
  const [narrative, setNarrative] = useState(storyline.narrative ?? "");
  const [grade1Theme, setGrade1Theme] = useState(storyline.grade_1_theme ?? "");
  const [grade2Theme, setGrade2Theme] = useState(storyline.grade_2_theme ?? "");
  const [grade3Theme, setGrade3Theme] = useState(storyline.grade_3_theme ?? "");
  const [strength, setStrength] = useState<string>(storyline.strength ?? "moderate");
  const queryClient = useQueryClient();

  const formData = { title, careerField, keywords, narrative, grade1Theme, grade2Theme, grade3Theme, strength };

  const handleSave = useCallback(
    async (data: typeof formData) => {
      const result = await updateStorylineAction(storyline.id, {
        title: data.title,
        career_field: data.careerField || null,
        keywords: data.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        narrative: data.narrative || null,
        grade_1_theme: data.grade1Theme || null,
        grade_2_theme: data.grade2Theme || null,
        grade_3_theme: data.grade3Theme || null,
        strength: data.strength || null,
      });
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: studentRecordKeys.storylineTab(studentId) });
      }
      return { success: result.success, error: !result.success && "error" in result ? result.error : undefined };
    },
    [storyline.id, studentId, queryClient],
  );

  const { status, error } = useAutoSave({
    data: formData,
    onSave: handleSave,
    enabled: isExpanded,
  });

  return (
    <div className="rounded-lg border border-border bg-white dark:border-border dark:bg-bg-primary">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-medium text-sm text-[var(--text-primary)]">{storyline.title}</span>
          <StorylineStrengthBadge strength={storyline.strength} />
          {storyline.career_field && (
            <span className="text-xs text-[var(--text-tertiary)]">{storyline.career_field}</span>
          )}
        </div>
        <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
          {isExpanded ? "접기" : "펼치기"}
        </span>
      </button>

      {!isExpanded && storyline.keywords.length > 0 && (
        <div className="flex gap-1 border-t border-border px-3 pb-3 pt-2 dark:border-border">
          {storyline.keywords.slice(0, 5).map((kw) => (
            <span key={kw} className="rounded bg-bg-tertiary px-1.5 py-0.5 text-xs text-[var(--text-secondary)] dark:bg-bg-secondary">
              {kw}
            </span>
          ))}
        </div>
      )}

      {isExpanded && (
        <div className="border-t border-border p-4 dark:border-border">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SaveStatusIndicator status={status} error={error} />
              <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">삭제</button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[var(--text-secondary)]">제목 *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-border bg-[var(--bg-surface)] px-3 py-2 text-sm dark:border-border"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--text-secondary)]">진로 분야</label>
                <input
                  value={careerField}
                  onChange={(e) => setCareerField(e.target.value)}
                  placeholder="예: 법·행정"
                  className="w-full rounded-md border border-border bg-[var(--bg-surface)] px-3 py-2 text-sm dark:border-border"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">키워드 (쉼표 구분)</label>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="예: 사회문제, 법, 정책"
                className="w-full rounded-md border border-border bg-[var(--bg-surface)] px-3 py-2 text-sm dark:border-border"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">강도</label>
              <select
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                className="rounded-md border border-border bg-[var(--bg-surface)] px-3 py-2 text-sm dark:border-border"
              >
                <option value="strong">강함</option>
                <option value="moderate">보통</option>
                <option value="weak">약함</option>
              </select>
            </div>

            {/* 학년별 테마 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "1학년 테마", value: grade1Theme, set: setGrade1Theme, ph: "관심·발견" },
                { label: "2학년 테마", value: grade2Theme, set: setGrade2Theme, ph: "탐구·심화" },
                { label: "3학년 테마", value: grade3Theme, set: setGrade3Theme, ph: "주도·실천" },
              ].map((g) => (
                <div key={g.label}>
                  <label className="mb-1 block text-xs text-[var(--text-secondary)]">{g.label}</label>
                  <input
                    value={g.value}
                    onChange={(e) => g.set(e.target.value)}
                    placeholder={g.ph}
                    className="w-full rounded-md border border-border bg-[var(--bg-surface)] px-3 py-2 text-sm dark:border-border"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">내러티브 (종합 서사)</label>
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={4}
                placeholder="학생의 3년간 성장 과정을 서술하세요..."
                className="w-full resize-y rounded-md border border-border bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-border"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// AddStorylineForm
// ============================================

function AddStorylineForm({
  studentId,
  tenantId,
  sortOrder,
  onClose,
}: {
  studentId: string;
  tenantId: string;
  sortOrder: number;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [careerField, setCareerField] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("제목을 입력해주세요.");
      const result = await saveStorylineAction({
        student_id: studentId,
        tenant_id: tenantId,
        title: title.trim(),
        career_field: careerField.trim() || null,
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
        <span className="text-sm font-medium text-[var(--text-primary)]">스토리라인 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">취소</button>
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="스토리라인 제목 *"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm dark:border-border dark:bg-bg-primary"
          />
          <input
            value={careerField}
            onChange={(e) => setCareerField(e.target.value)}
            placeholder="진로 분야 (예: 법·행정)"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm dark:border-border dark:bg-bg-primary"
          />
        </div>
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
