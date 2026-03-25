"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { activitySummaryListOptions, activitySummaryKeys } from "@/lib/query-options/activitySummary";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { generateActivitySummary } from "@/lib/domains/student-record/llm/actions/generateActivitySummary";
import {
  updateActivitySummaryStatus,
  editActivitySummary,
  deleteActivitySummary,
} from "@/lib/domains/student-record/actions/activitySummary";
import type { ActivitySummarySection, ActivitySummaryStatus } from "@/lib/domains/student-record/types";
import { ReportExportMenu } from "./ReportExportMenu";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "초안", color: "bg-gray-100 text-gray-600" },
  confirmed: { label: "확정", color: "bg-blue-100 text-blue-700" },
  published: { label: "공개", color: "bg-emerald-100 text-emerald-700" },
};

const SECTION_LABELS: Record<string, string> = {
  intro: "소개",
  subject_setek: "교과 학습 활동",
  personal_setek: "개인 탐구 활동",
  changche: "창의적 체험활동",
  reading: "독서 활동",
  haengteuk: "학교생활 및 인성",
  growth: "종합 성장 요약",
};

interface ActivitySummaryPanelProps {
  studentId: string;
  studentGrade: number;
  studentName?: string;
}

export function ActivitySummaryPanel({
  studentId,
  studentGrade,
  studentName = "학생",
}: ActivitySummaryPanelProps) {
  const queryClient = useQueryClient();
  const [selectedGrades, setSelectedGrades] = useState<number[]>(
    Array.from({ length: studentGrade }, (_, i) => i + 1),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isPending, startTransition] = useTransition();

  const { data: summaries, isLoading } = useQuery(
    activitySummaryListOptions(studentId),
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await generateActivitySummary(studentId, selectedGrades);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: activitySummaryKeys.list(studentId),
      });
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.pipeline(studentId),
      });
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: activitySummaryKeys.list(studentId),
    });

  function handleStatusChange(id: string, status: ActivitySummaryStatus) {
    startTransition(async () => {
      await updateActivitySummaryStatus(id, status);
      invalidate();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteActivitySummary(id);
      invalidate();
    });
  }

  function handleEditSave(id: string) {
    startTransition(async () => {
      await editActivitySummary(id, editText);
      setEditingId(null);
      invalidate();
    });
  }

  function toggleGrade(g: number) {
    setSelectedGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort(),
    );
  }

  if (isLoading) {
    return <div className="animate-pulse space-y-3"><div className="h-8 rounded bg-[var(--surface-hover)]" /><div className="h-20 rounded bg-[var(--surface-hover)]" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* 생성 영역 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">대상 학년:</span>
          {Array.from({ length: studentGrade }, (_, i) => i + 1).map((g) => (
            <label key={g} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={selectedGrades.includes(g)}
                onChange={() => toggleGrade(g)}
                className="h-3.5 w-3.5 rounded"
              />
              {g}학년
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || selectedGrades.length === 0}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {generateMutation.isPending ? "생성 중..." : "AI 활동 요약서 생성"}
        </button>
      </div>

      {generateMutation.isError && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-red-500">
            {generateMutation.error?.message ?? "생성 실패"}
          </p>
          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            className="rounded px-2 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 내부 분석용 안내 */}
      <p className="text-[10px] text-[var(--text-tertiary)]">
        내부 분석용 — 학생/학부모 미공개 · 확정 전까지 초안 상태
      </p>

      {/* 기존 요약서 목록 */}
      {summaries && summaries.length > 0 ? (
        <div className="space-y-4">
          {summaries.map((summary) => {
            const rawSections = summary.summary_sections;
            const sections = (Array.isArray(rawSections) ? rawSections : []) as ActivitySummarySection[];
            const statusInfo = STATUS_LABELS[summary.status] ?? STATUS_LABELS.draft;
            const displayText = summary.edited_text ?? summary.summary_text;
            const isEditing = editingId === summary.id;

            return (
              <div
                key={summary.id}
                className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)]"
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between border-b border-[var(--border-secondary)] px-4 py-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-[var(--text-primary)]">
                      {summary.summary_title}
                    </h4>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {summary.target_grades.join(",")}학년 ·{" "}
                      {new Date(summary.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {summary.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(summary.id, "confirmed")}
                        disabled={isPending}
                        className="rounded px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-50"
                      >
                        확정
                      </button>
                    )}
                    {summary.status === "confirmed" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(summary.id, "published")}
                        disabled={isPending}
                        className="rounded px-2 py-1 text-[10px] font-medium text-emerald-600 hover:bg-emerald-50"
                      >
                        학생 공개
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          setEditingId(null);
                        } else {
                          setEditText(displayText);
                          setEditingId(summary.id);
                        }
                      }}
                      className="rounded px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    >
                      {isEditing ? "취소" : "편집"}
                    </button>
                    <Link
                      href={`/admin/students/${studentId}/activity-summary`}
                      target="_blank"
                      className="rounded px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    >
                      인쇄
                    </Link>
                    <ReportExportMenu
                      data={{
                        title: summary.summary_title,
                        studentName,
                        targetGrades: summary.target_grades,
                        createdAt: summary.created_at,
                        sections,
                        editedText: summary.edited_text,
                      }}
                    />
                    {summary.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => handleDelete(summary.id)}
                        disabled={isPending}
                        className="rounded px-2 py-1 text-[10px] text-red-500 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>

                {/* 본문 */}
                <div className="px-4 py-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={12}
                        className="w-full rounded border border-[var(--border-primary)] bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleEditSave(summary.id)}
                        disabled={isPending}
                        className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        저장
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sections.map((sec, i) => (
                        <div key={i}>
                          <p className="text-xs font-semibold text-[var(--text-secondary)]">
                            {SECTION_LABELS[sec.sectionType] ?? sec.title}
                            {sec.relatedSubjects && sec.relatedSubjects.length > 0 && (
                              <span className="ml-1 font-normal text-[var(--text-tertiary)]">
                                ({sec.relatedSubjects.join(", ")})
                              </span>
                            )}
                          </p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
                            {sec.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-tertiary)]">
          생성된 활동 요약서가 없습니다. 위 버튼을 눌러 AI 요약서를 생성하세요.
        </p>
      )}
    </div>
  );
}
