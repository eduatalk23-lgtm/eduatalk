"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";

type ParticipantStat = {
  student_id: string;
  student_name: string;
  study_minutes: number;
  plan_completion_rate: number;
  subject_distribution: Record<string, number>;
};

type StudentPlanProgressTableProps = {
  templateId: string;
  participantStats: ParticipantStat[];
  selectedStudentIds?: string[];
};

/**
 * 학습 시간 포맷팅 (분 → 시간:분)
 */
function formatStudyTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}시간 ${mins}분`;
  }
  return `${mins}분`;
}

/**
 * 완료율 색상 클래스
 */
function getCompletionRateColorClass(rate: number): string {
  if (rate >= 90) {
    return "bg-green-100 text-green-800";
  }
  if (rate >= 70) {
    return "bg-yellow-100 text-yellow-800";
  }
  return "bg-red-100 text-red-800";
}

export function StudentPlanProgressTable({
  templateId,
  participantStats,
  selectedStudentIds,
}: StudentPlanProgressTableProps) {
  // 학생 필터 적용
  const filteredStats = selectedStudentIds && selectedStudentIds.length > 0
    ? participantStats.filter((stat) => selectedStudentIds.includes(stat.student_id))
    : participantStats;

  if (filteredStats.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-gray-700">참여자가 없습니다.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">
          학생별 학습 진행 현황
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  이름
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  완료율
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  총 학습 시간
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  평균 일일 학습 시간
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  상세
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.map((stat) => {
                // 평균 일일 학습 시간 계산 (30일 기준, 실제로는 템플릿 기간 사용)
                const averageDailyMinutes = Math.round(stat.study_minutes / 30);

                return (
                  <tr
                    key={stat.student_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {stat.student_name}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getCompletionRateColorClass(
                          stat.plan_completion_rate
                        )}`}
                      >
                        {stat.plan_completion_rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">
                      {formatStudyTime(stat.study_minutes)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">
                      {formatStudyTime(averageDailyMinutes)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      <Link
                        href={`/admin/students/${stat.student_id}?tab=plans`}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        보기
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

