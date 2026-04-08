"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { setekGuideListOptions, setekGuideKeys } from "@/lib/query-options/setekGuide";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { generateSetekGuide } from "@/lib/domains/student-record/llm/actions/generateSetekGuide";
import {
  updateActivitySummaryStatus,
  editActivitySummary,
  deleteActivitySummary,
} from "@/lib/domains/student-record/actions/activitySummary";
import type { SetekGuideItem, ActivitySummaryStatus } from "@/lib/domains/student-record/types";
import { ReportExportMenu } from "../../ReportExportMenu";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "초안", color: "bg-gray-100 text-gray-600" },
  confirmed: { label: "확정", color: "bg-blue-100 text-blue-700" },
};

const COMPETENCY_LABELS: Record<string, string> = {
  academic_achievement: "학업성취",
  academic_attitude: "학업태도",
  academic_inquiry: "탐구역량",
  career_course_effort: "진로 노력",
  career_course_achievement: "진로 성취",
  career_exploration: "진로탐색",
  community_collaboration: "협업",
  community_caring: "나눔·배려",
  community_integrity: "성실성",
  community_leadership: "리더십",
};

interface SetekGuidePanelProps {
  studentId: string;
  studentGrade: number;
  studentName?: string;
}

export function SetekGuidePanel({
  studentId,
  studentGrade,
  studentName = "학생",
}: SetekGuidePanelProps) {
  const queryClient = useQueryClient();
  const [selectedGrades, setSelectedGrades] = useState<number[]>(
    Array.from({ length: studentGrade }, (_, i) => i + 1),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isPending, startTransition] = useTransition();

  const { data: guides, isLoading } = useQuery(
    setekGuideListOptions(studentId),
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await generateSetekGuide(studentId, selectedGrades);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: setekGuideKeys.list(studentId),
      });
      // 파이프라인 상태가 sync되었으므로 UI 갱신
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.pipeline(studentId),
      });
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: setekGuideKeys.list(studentId),
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
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 rounded bg-[var(--surface-hover)]" />
        <div className="h-20 rounded bg-[var(--surface-hover)]" />
      </div>
    );
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
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {generateMutation.isPending ? "생성 중..." : "AI 세특 방향 가이드 생성"}
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
            className="rounded px-2 py-0.5 text-xs font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 내부 분석용 안내 + 모드 표시 */}
      <div className="flex items-center gap-2">
        <p className="text-[10px] text-[var(--text-tertiary)]">
          내부 분석용 — 학생/학부모 미공개 · 확정 전까지 초안 상태
        </p>
        {guides && guides.some((g) => g.prompt_version === "guide_v1_prospective") && (
          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            계획 기반
          </span>
        )}
      </div>

      {/* 기존 가이드 목록 */}
      {guides && guides.length > 0 ? (
        <div className="space-y-4">
          {guides.map((guide) => {
            const statusInfo = STATUS_LABELS[guide.status] ?? STATUS_LABELS.draft;
            const isEditing = editingId === guide.id;

            return (
              <div
                key={guide.id}
                className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)]"
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between border-b border-[var(--border-secondary)] px-4 py-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-[var(--text-primary)]">
                      {guide.subject_id}
                    </h4>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {guide.source === "ai" ? "🤖AI" : "👤수동"} ·{" "}
                      {new Date(guide.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {guide.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(guide.id, "confirmed")}
                        disabled={isPending}
                        className="rounded px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-50"
                      >
                        확정
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          setEditingId(null);
                        } else {
                          setEditText(guide.direction);
                          setEditingId(guide.id);
                        }
                      }}
                      className="rounded px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    >
                      {isEditing ? "취소" : "편집"}
                    </button>
                    <ReportExportMenu
                      data={{
                        title: guide.subject_id,
                        studentName,
                        targetGrades: [guide.school_year],
                        createdAt: guide.created_at,
                        sections: [{
                          sectionType: "guide_0",
                          title: guide.subject_id,
                          content: `${guide.direction}${guide.cautions ? `\n\n⚠ ${guide.cautions}` : ""}${guide.teacher_points.length > 0 ? `\n\n교사 전달 포인트:\n${guide.teacher_points.map((p: string) => `· ${p}`).join("\n")}` : ""}`,
                          relatedSubjects: guide.keywords.slice(0, 3),
                        }],
                        editedText: undefined,
                      }}
                    />
                    {guide.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => handleDelete(guide.id)}
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
                        onClick={() => handleEditSave(guide.id)}
                        disabled={isPending}
                        className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                      >
                        저장
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* 전체 방향 */}
                      {guide.overall_direction && (
                        <div className="rounded-md bg-violet-50 px-3 py-2 dark:bg-violet-950/30">
                          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                            전체 방향
                          </p>
                          <p className="mt-0.5 text-sm text-[var(--text-primary)]">
                            {guide.overall_direction}
                          </p>
                        </div>
                      )}

                      {/* 과목 가이드 상세 */}
                      <div className="rounded-lg border border-[var(--border-secondary)] p-3">
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-semibold text-[var(--text-primary)]">
                            {guide.subject_id}
                          </h5>
                          {guide.competency_focus.map((cf: string) => (
                            <span
                              key={cf}
                              className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                            >
                              {COMPETENCY_LABELS[cf] ?? cf}
                            </span>
                          ))}
                        </div>

                        {/* 키워드 pills */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {guide.keywords.map((kw: string) => (
                            <span
                              key={kw}
                              className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>

                        {/* 방향 */}
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
                          {guide.direction}
                        </p>

                        {/* 주의사항 */}
                        {guide.cautions && (
                          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                            ⚠ {guide.cautions}
                          </p>
                        )}

                        {/* 교사 전달 포인트 */}
                        {guide.teacher_points.length > 0 && (
                          <div className="mt-2 border-t border-[var(--border-secondary)] pt-2">
                            <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
                              교사 전달 포인트
                            </p>
                            <ul className="mt-0.5 space-y-0.5">
                              {guide.teacher_points.map((tp: string, j: number) => (
                                <li
                                  key={j}
                                  className="text-xs text-[var(--text-secondary)]"
                                >
                                  · {tp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-tertiary)]">
          생성된 세특 방향 가이드가 없습니다. 위 버튼을 눌러 AI 가이드를 생성하세요.
        </p>
      )}
    </div>
  );
}
