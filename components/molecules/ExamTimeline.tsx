"use client";

import { useMemo } from "react";
import { getStudentExamTimeline } from "@/lib/utils/studentProfile";

interface ExamTimelineProps {
  grade: string | null | undefined;
  schoolType?: "중학교" | "고등학교";
}

/**
 * 학년 기반 수능 타임라인 읽기 전용 표시
 *
 * 학년만으로 수능 시행일, 학년도, 교육과정, 대학 입학 시기를 보여준다.
 */
export default function ExamTimeline({ grade, schoolType }: ExamTimelineProps) {
  const timeline = useMemo(
    () => getStudentExamTimeline(grade, schoolType),
    [grade, schoolType],
  );

  if (!timeline) {
    return (
      <p className="text-sm text-[var(--text-tertiary)]">
        학년을 선택하면 수능 일정이 자동으로 표시됩니다.
      </p>
    );
  }

  const items = [
    { label: "학년", value: timeline.gradeLabel },
    { label: "교육과정", value: timeline.curriculumRevision },
    { label: "수능 시행", value: timeline.examDate },
    { label: "학년도", value: timeline.examLabel },
    { label: "대학 입학", value: timeline.universityEntrance },
  ];

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3">
      <dl className="flex items-center gap-6 overflow-x-auto text-sm">
        {items.map((item, i) => (
          <div key={item.label} className="flex shrink-0 items-center gap-6">
            <div className="min-w-0">
              <dt className="text-xs text-[var(--text-tertiary)]">{item.label}</dt>
              <dd className="font-medium text-[var(--text-primary)] whitespace-nowrap">{item.value}</dd>
            </div>
            {i < items.length - 1 && (
              <span className="text-[var(--text-tertiary)]" aria-hidden>→</span>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
