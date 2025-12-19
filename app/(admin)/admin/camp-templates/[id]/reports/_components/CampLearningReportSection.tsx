"use client";

import type { CampLearningStats } from "@/lib/domains/camp/types";
import { Card } from "@/components/ui/Card";

type CampLearningReportSectionProps = {
  learningStats: CampLearningStats;
};

export function CampLearningReportSection({
  learningStats,
}: CampLearningReportSectionProps) {
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-gray-900">학습 리포트</h2>

        {/* 통계 요약 */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-600">총 학습 시간</p>
            <p className="text-2xl font-semibold text-gray-900">
              {Math.floor(learningStats.total_study_minutes / 60)}시간{" "}
              {learningStats.total_study_minutes % 60}분
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-600">
              평균 학습 시간 (참여자당)
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              {Math.floor(
                learningStats.average_study_minutes_per_participant / 60
              )}
              시간 {learningStats.average_study_minutes_per_participant % 60}분
            </p>
          </div>
        </div>

        {/* 참여자별 학습 현황 */}
        {learningStats.participant_stats.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    이름
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    학습 시간
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    플랜 완료율
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    주요 과목
                  </th>
                </tr>
              </thead>
              <tbody>
                {learningStats.participant_stats.map((stat) => {
                  // 주요 과목 추출 (학습 시간이 많은 순)
                  const topSubjects = Object.entries(stat.subject_distribution)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([subject]) => subject);

                  return (
                    <tr
                      key={stat.student_id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {stat.student_name}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">
                        {Math.floor(stat.study_minutes / 60)}시간{" "}
                        {stat.study_minutes % 60}분
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            stat.plan_completion_rate >= 80
                              ? "bg-green-100 text-green-800"
                              : stat.plan_completion_rate >= 60
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {stat.plan_completion_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">
                        {topSubjects.length > 0 ? (
                          <div className="flex flex-wrap justify-center gap-1">
                            {topSubjects.map((subject) => (
                              <span
                                key={subject}
                                className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                              >
                                {subject}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

