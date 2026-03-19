"use client";

import { useQuery } from "@tanstack/react-query";
import { activitySummaryListOptions } from "@/lib/query-options/activitySummary";
import type { ActivitySummarySection } from "@/lib/domains/student-record/types";

const SECTION_LABELS: Record<string, string> = {
  intro: "소개",
  subject_setek: "교과 학습 활동",
  personal_setek: "개인 탐구 활동",
  changche: "창의적 체험활동",
  reading: "독서 활동",
  haengteuk: "학교생활 및 인성",
  growth: "종합 성장 요약",
};

interface ActivitySummaryPrintProps {
  studentId: string;
  studentName: string | null;
}

export function ActivitySummaryPrint({
  studentId,
  studentName,
}: ActivitySummaryPrintProps) {
  const { data: summaries, isLoading, error } = useQuery(
    activitySummaryListOptions(studentId),
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse space-y-4 p-8">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="h-4 w-3/4 rounded bg-gray-100" />
      </div>
    );
  }

  if (error || !summaries || summaries.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-gray-500">
          {error ? "데이터를 불러올 수 없습니다." : "생성된 활동 요약서가 없습니다."}
        </p>
      </div>
    );
  }

  // 가장 최근 요약서 사용
  const summary = summaries[0];
  const sections = (summary.summary_sections ?? []) as ActivitySummarySection[];
  const displayText = summary.edited_text ?? summary.summary_text;
  const date = new Date(summary.created_at);
  const dateStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;

  return (
    <div className="mx-auto max-w-3xl bg-white px-8 py-6 text-gray-900">
      {/* 인쇄 버튼 */}
      <div className="flex justify-end pb-6 print:hidden" data-print-hide>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          PDF 저장 / 인쇄
        </button>
      </div>

      {/* 제목 */}
      <div className="border-b-2 border-gray-800 pb-4 text-center">
        <h1 className="text-2xl font-bold">{summary.summary_title}</h1>
        <p className="pt-2 text-sm text-gray-500">
          {studentName ?? "학생"} · {summary.target_grades.join(",")}학년 · {dateStr}
        </p>
      </div>

      {/* 섹션별 렌더링 */}
      {summary.edited_text ? (
        // 수동 편집된 경우 플레인텍스트
        <div className="whitespace-pre-wrap pt-6 text-sm leading-relaxed text-gray-800">
          {displayText}
        </div>
      ) : (
        // AI 원본: 섹션별 구조
        <div className="space-y-6 pt-6">
          {sections.map((sec, i) => (
            <div key={i} className="print-avoid-break">
              <h2 className="border-b border-gray-200 pb-1 text-base font-semibold text-gray-900">
                {SECTION_LABELS[sec.sectionType] ?? sec.title}
                {sec.relatedSubjects && sec.relatedSubjects.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    ({sec.relatedSubjects.join(", ")})
                  </span>
                )}
              </h2>
              <p className="whitespace-pre-wrap pt-2 text-sm leading-relaxed text-gray-800">
                {sec.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
