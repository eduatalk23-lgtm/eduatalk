"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { SubjectStats } from "@/lib/domains/plan/actions/statistics";
import { cn } from "@/lib/cn";

type SubjectProgressListProps = {
  subjects: SubjectStats[];
};

const SUBJECT_COLORS: Record<string, string> = {
  국어: "#EF4444",
  수학: "#3B82F6",
  영어: "#10B981",
  과학: "#8B5CF6",
  사회: "#F59E0B",
  한국사: "#EC4899",
  기타: "#6B7280",
};

export function SubjectProgressList({ subjects }: SubjectProgressListProps) {
  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours === 0) return `${mins}분`;
    return `${hours}시간 ${mins}분`;
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "improving") {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    if (trend === "declining") {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getSubjectColor = (subject: string) => {
    return SUBJECT_COLORS[subject] || SUBJECT_COLORS["기타"];
  };

  if (subjects.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          과목별 진행률
        </h3>
        <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            아직 과목별 데이터가 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        과목별 진행률
      </h3>

      <div className="mt-4 space-y-4">
        {subjects.slice(0, 5).map((subject) => (
          <div key={subject.subject} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: getSubjectColor(subject.subject) }}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {subject.subject}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.round(subject.completionRate)}%
                </span>
                {getTrendIcon(subject.trend)}
              </div>
            </div>

            {/* 진행률 바 */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${subject.completionRate}%`,
                  backgroundColor: getSubjectColor(subject.subject),
                }}
              />
            </div>

            {/* 상세 정보 */}
            <div className="flex justify-between text-xs text-gray-400">
              <span>
                {subject.completedPlans}/{subject.totalPlans} 완료
              </span>
              <span>총 {formatMinutes(subject.totalMinutes)}</span>
            </div>
          </div>
        ))}
      </div>

      {subjects.length > 5 && (
        <button
          type="button"
          className="mt-4 w-full rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          +{subjects.length - 5}개 더 보기
        </button>
      )}
    </div>
  );
}
