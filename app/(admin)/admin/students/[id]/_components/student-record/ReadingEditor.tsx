"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addReadingAction, removeReadingAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { RecordReading } from "@/lib/domains/student-record";
import { useStudentRecordContext } from "./StudentRecordContext";
import { useSidePanel } from "@/components/side-panel";
import { cn } from "@/lib/cn";
import { FileText, Search, MessageSquare } from "lucide-react";

// ─── 탭 정의 ──────────────────────────────────────

type ReadingLayerTab = "record" | "analysis" | "chat";

const READING_TABS: { key: ReadingLayerTab; label: string; icon: typeof FileText }[] = [
  { key: "record", label: "기록", icon: FileText },
  { key: "analysis", label: "분석", icon: Search },
  { key: "chat", label: "논의", icon: MessageSquare },
];

const COMPETENCY_LABELS: Record<string, string> = {
  academic_achievement: "학업성취도", academic_attitude: "학업태도", academic_inquiry: "탐구력",
  career_course_effort: "과목이수노력", career_course_achievement: "과목성취도", career_exploration: "진로탐색",
  community_collaboration: "협업", community_caring: "배려", community_integrity: "성실성", community_leadership: "리더십",
};

const EVAL_COLORS: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  negative: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  needs_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

// ─── 타입 ──────────────────────────────────────

interface ActivityTagLike {
  record_type: string;
  record_id: string;
  competency_item: string;
  evaluation: string;
  evidence_summary?: string | null;
}

type ReadingEditorProps = {
  readings: RecordReading[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  diagnosisActivityTags?: ActivityTagLike[];
};

export function ReadingEditor({
  readings,
  studentId,
  schoolYear,
  tenantId,
  grade,
  diagnosisActivityTags,
}: ReadingEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<ReadingLayerTab>("record");
  const queryClient = useQueryClient();

  // 역량 태그 필터: reading record_type만
  const allReadingIds = useMemo(() => new Set(readings.map((r) => r.id)), [readings]);
  const filteredTags = useMemo(() => {
    if (!diagnosisActivityTags) return [];
    return diagnosisActivityTags.filter(
      (t) => t.record_type === "reading" && allReadingIds.has(t.record_id),
    );
  }, [diagnosisActivityTags, allReadingIds]);

  // 사이드 패널 연결
  const { setActiveSubjectId } = useStudentRecordContext();
  const sidePanel = useSidePanel();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await removeReadingAction(id);
      if (!result.success) throw new Error("error" in result ? result.error : "삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
      });
    },
  });

  const handleDelete = (id: string, title: string) => {
    if (confirm(`"${title}" 독서 기록을 삭제하시겠습니까?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 레이어 탭 바 ───────────────────────── */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-secondary)]">
        {READING_TABS.map((tab) => {
          const hasData = tab.key === "record" ? readings.length > 0
            : tab.key === "analysis" ? filteredTags.length > 0
            : false;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex items-center gap-1 border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
              title={tab.label}
            >
              <tab.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              {hasData && tab.key !== "record" && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 📄 기록 탭 (기본) ──────────────────── */}
      {activeTab === "record" && (
        <div className="flex flex-col gap-4">
          {/* 독서 목록 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-gray-400 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">제목</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">저자</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">과목 또는 영역</th>
                </tr>
              </thead>
              <tbody>
                {readings.length === 0 && !showAddForm && (
                  <tr>
                    <td colSpan={3} className="border border-gray-400 px-4 py-2 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-500">
                      등록된 독서 기록이 없습니다.
                    </td>
                  </tr>
                )}
                {readings.map((reading) => (
                  <tr key={reading.id} className="group">
                    <td className="border border-gray-400 px-2 py-1 text-sm text-[var(--text-primary)] dark:border-gray-500">{reading.book_title}</td>
                    <td className="border border-gray-400 px-2 py-1 text-sm text-[var(--text-secondary)] dark:border-gray-500">{reading.author ?? "-"}</td>
                    <td className="relative border border-gray-400 px-2 py-1 text-sm text-[var(--text-secondary)] dark:border-gray-500">
                      {reading.subject_area}
                      <button
                        onClick={() => handleDelete(reading.id, reading.book_title)}
                        disabled={deleteMutation.isPending}
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500 invisible transition-all hover:bg-red-100 hover:text-red-700 disabled:opacity-50 group-hover:visible dark:bg-red-950/30 dark:hover:bg-red-950/50"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 추가 폼 */}
          {showAddForm ? (
            <AddReadingForm
              studentId={studentId}
              schoolYear={schoolYear}
              tenantId={tenantId}
              grade={grade}
              onClose={() => setShowAddForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              + 독서 추가
            </button>
          )}
        </div>
      )}

      {/* ─── 🔍 분석 탭 ──────────────────────────── */}
      {activeTab === "analysis" && (
        <div className="flex flex-col gap-2">
          {filteredTags.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">
              AI 분석을 실행하면 이 영역의 역량 태그가 표시됩니다
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(
                filteredTags.reduce<Record<string, ActivityTagLike[]>>((acc, tag) => {
                  const key = tag.competency_item;
                  (acc[key] ??= []).push(tag);
                  return acc;
                }, {}),
              ).map(([item, tags]) => (
                <div key={item} className="rounded-lg border border-[var(--border-secondary)] p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {COMPETENCY_LABELS[item] ?? item}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{tags.length}건</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag, i) => (
                      <span
                        key={i}
                        className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", EVAL_COLORS[tag.evaluation] ?? "bg-gray-100 text-gray-600")}
                        title={tag.evidence_summary ?? undefined}
                      >
                        {tag.evaluation === "positive" ? "+" : tag.evaluation === "negative" ? "-" : "?"}{" "}
                        {tag.evidence_summary?.slice(0, 30) ?? ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 💬 논의 탭 ──────────────────────────── */}
      {activeTab === "chat" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <MessageSquare className="h-8 w-8 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">독서 영역에 대해 학생/학부모와 논의</p>
          <button
            type="button"
            onClick={() => {
              if (setActiveSubjectId) {
                setActiveSubjectId("reading");
              }
              sidePanel.openApp("chat");
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            채팅 열기
          </button>
        </div>
      )}
    </div>
  );
}

function AddReadingForm({
  studentId,
  schoolYear,
  tenantId,
  grade,
  onClose,
}: {
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  onClose: () => void;
}) {
  const [bookTitle, setBookTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subjectArea, setSubjectArea] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!bookTitle.trim()) throw new Error("제목을 입력해주세요.");
      if (!subjectArea.trim()) throw new Error("관련 과목을 입력해주세요.");
      const result = await addReadingAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        book_title: bookTitle.trim(),
        author: author.trim() || null,
        subject_area: subjectArea.trim(),
      });
      if (!result.success) throw new Error("error" in result ? result.error : "추가 실패");
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
        <span className="text-sm font-medium text-[var(--text-primary)]">독서 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
          취소
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            placeholder="도서명 *"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="저자"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <input
            value={subjectArea}
            onChange={(e) => setSubjectArea(e.target.value)}
            placeholder="관련 과목 *"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
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
        {mutation.isError && (
          <p className="text-xs text-red-600">{mutation.error.message}</p>
        )}
      </div>
    </div>
  );
}
