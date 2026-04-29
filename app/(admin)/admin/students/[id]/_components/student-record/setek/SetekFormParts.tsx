"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { CharacterCounter } from "../CharacterCounter";
import { saveSetekAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { SetekLayerTab } from "../stages/record/SetekEditor";
import type { LayerPerspective } from "@/lib/domains/student-record/layer-view";
import { GuideAssignmentCard, type GuideAssignmentLike } from "../shared/GuideAssignmentCard";

// ─── PlannedSubjectRow ───────────────────────────────────────────────────────

type PlannedSubject = {
  subjectId: string;
  subjectName: string;
  semester: number;
};

const B = "border border-gray-400 dark:border-gray-500";

export function PlannedSubjectRow({
  planned,
  studentId,
  schoolYear,
  tenantId,
  grade,
  charLimit,
  activeTab,
  subjectGuides,
  perspective,
}: {
  planned: PlannedSubject;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  charLimit: number;
  /** 현재 활성 탭. 기본 neis (=세특 생성 버튼) */
  activeTab?: SetekLayerTab;
  /** 이 planned 과목(subject_id)에 배정된 탐구 가이드 (Wave 5.1b) */
  subjectGuides?: GuideAssignmentLike[];
  /** AI / consultant 관점 필터링 */
  perspective?: LayerPerspective | null;
}) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await saveSetekAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        semester: planned.semester,
        subject_id: planned.subjectId,
        content: "",
        char_limit: charLimit,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "세특 생성 실패");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
      });
    },
  });

  // Wave 5.1b: guide 탭일 때는 세특 생성 버튼 대신 배정된 탐구 가이드 카드를 렌더.
  // (설계 학년 = NEIS 없음 = 전부 planned → 이 분기가 없으면 가이드 14건이 통째로 숨음)
  const renderGuideCell = () => {
    let list = subjectGuides ?? [];
    if (perspective === "ai") {
      list = list.filter((g) => g.ai_recommendation_reason);
    } else if (perspective === "consultant") {
      list = list.filter((g) => !g.ai_recommendation_reason);
    }
    if (list.length === 0) {
      return (
        <span className="text-xs text-blue-500/70 dark:text-blue-400/70">
          {perspective === "ai"
            ? "AI 추천 가이드가 없습니다"
            : perspective === "consultant"
              ? "배정된 가이드가 없습니다"
              : "가이드 없음"}
        </span>
      );
    }
    return (
      <div className="flex flex-col gap-1.5">
        {list.map((a) => (
          <GuideAssignmentCard key={a.id} assignment={a} showSimBadge />
        ))}
      </div>
    );
  };

  return (
    <tr className="align-top">
      <td className="border border-dashed border-blue-200 bg-blue-50/30 px-2 py-2 text-center align-middle text-sm text-blue-400 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-500">
        {grade}
      </td>
      <td className="border border-dashed border-blue-200 bg-blue-50/30 px-3 py-2 text-center align-middle dark:border-blue-800 dark:bg-blue-950/20">
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
          {planned.subjectName}
        </span>
        <span className="ml-1.5 inline-flex rounded-full bg-blue-100 px-1.5 py-0.5 text-2xs font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
          계획됨
        </span>
      </td>
      <td className="border border-dashed border-blue-200 bg-blue-50/30 p-2 dark:border-blue-800 dark:bg-blue-950/20">
        {activeTab === "guide" ? (
          renderGuideCell()
        ) : (
          <>
            <div className="flex items-center gap-2 py-1">
              <ClipboardList className="h-4 w-4 shrink-0 text-blue-400" />
              <span className="text-xs text-blue-500 dark:text-blue-400">
                수강 계획 확정 · {planned.semester}학기
              </span>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="ml-auto rounded-md bg-blue-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {createMutation.isPending ? "생성 중..." : "세특 생성"}
              </button>
            </div>
            {createMutation.isError && (
              <p className="mt-1 text-xs text-red-600">{createMutation.error.message}</p>
            )}
          </>
        )}
      </td>
    </tr>
  );
}

// ─── AddSetekForm ────────────────────────────────────────────────────────────

export function AddSetekForm({
  subjects,
  studentId,
  schoolYear,
  tenantId,
  grade,
  charLimit,
  onClose,
}: {
  subjects: { id: string; name: string }[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  charLimit: number;
  onClose: () => void;
}) {
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [semester, setSemester] = useState(1);
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubjectId) throw new Error("과목을 선택해주세요.");
      const result = await saveSetekAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        semester,
        subject_id: selectedSubjectId,
        content,
        char_limit: charLimit,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "저장 실패");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
      });
      onClose();
    },
  });

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">과목 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
          취소
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm dark:border-border dark:bg-bg-primary"
          >
            <option value="">과목 선택...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
            className="w-28 rounded-md border border-border bg-white px-3 py-2 text-sm dark:border-border dark:bg-bg-primary"
          >
            <option value={1}>1학기</option>
            <option value={2}>2학기</option>
          </select>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-md border border-border bg-white p-3 text-sm placeholder:text-text-tertiary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-border dark:bg-bg-primary"
          placeholder="세특 내용을 입력하세요..."
        />
        <div className="flex items-center justify-between">
          <CharacterCounter content={content} charLimit={charLimit} />
          <button
            onClick={() => mutation.mutate()}
            disabled={!selectedSubjectId || mutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? "저장 중..." : "추가"}
          </button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-600">{mutation.error.message}</p>
        )}
      </div>
    </div>
  );
}
