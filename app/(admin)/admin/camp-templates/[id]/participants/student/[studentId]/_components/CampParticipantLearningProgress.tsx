"use client";

import { Card } from "@/components/ui/Card";
import type { ParticipantLearningStats } from "@/lib/domains/camp/types";

type CampParticipantLearningProgressProps = {
  templateId: string;
  studentId: string;
  learningStats: ParticipantLearningStats;
};

export function CampParticipantLearningProgress({
  templateId,
  studentId,
  learningStats,
}: CampParticipantLearningProgressProps) {
  // 과목별 학습 시간 상위 5개
  const topSubjects = Object.entries(learningStats.subject_distribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-gray-900">학습 진행 현황</h2>

        {/* 플랜 완료 현황 */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">플랜 완료</p>
            <p className="text-lg font-semibold text-gray-900">
              {learningStats.completed_plans} / {learningStats.total_plans} (
              {learningStats.plan_completion_rate}%)
            </p>
          </div>
        </div>

        {/* 과목별 학습 시간 분포 */}
        {topSubjects.length > 0 && (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-gray-900">
              과목별 학습 시간 (상위 5개)
            </h3>
            <div className="space-y-2">
              {topSubjects.map(([subject, minutes]) => {
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                return (
                  <div
                    key={subject}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {subject}
                    </span>
                    <span className="text-sm text-gray-600">
                      {hours > 0 ? `${hours}시간 ` : ""}
                      {mins}분
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {topSubjects.length === 0 && (
          <p className="text-sm text-gray-500">과목별 학습 데이터가 없습니다.</p>
        )}
      </div>
    </Card>
  );
}

