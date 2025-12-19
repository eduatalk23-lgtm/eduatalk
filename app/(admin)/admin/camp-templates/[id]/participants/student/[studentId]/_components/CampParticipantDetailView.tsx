"use client";

import Link from "next/link";
import { CampTemplate } from "@/lib/types/plan";
import type { ParticipantStatsData } from "../_utils/getParticipantStats";
import { CampParticipantStatsCards } from "./CampParticipantStatsCards";
import { CampParticipantAttendanceHistory } from "./CampParticipantAttendanceHistory";
import { CampParticipantLearningProgress } from "./CampParticipantLearningProgress";

type CampParticipantDetailViewProps = {
  template: CampTemplate;
  studentId: string;
  participantStats: ParticipantStatsData;
  planGroupId: string | null;
};

export function CampParticipantDetailView({
  template,
  studentId,
  participantStats,
  planGroupId,
}: CampParticipantDetailViewProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              참여자 상세 - {participantStats.student_name}
            </h1>
            <p className="text-sm text-gray-500">
              {template.name} 참여자의 상세 통계를 확인하세요.
            </p>
          </div>

          {/* 버튼 영역 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/admin/camp-templates/${template.id}/participants`}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              ← 참여자 목록
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              {planGroupId && (
                <Link
                  href={`/admin/camp-templates/${template.id}/participants/${planGroupId}/reschedule`}
                  className="inline-flex items-center justify-center rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  플랜 재조정
                </Link>
              )}
              <Link
                href={`/admin/students/${studentId}?tab=attendance`}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                학생 상세
              </Link>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <CampParticipantStatsCards
          attendanceStats={participantStats.attendance_stats}
          learningStats={participantStats.learning_stats}
        />

        {/* 출석 이력 */}
        {participantStats.attendance_stats && (
          <CampParticipantAttendanceHistory
            templateId={template.id}
            studentId={studentId}
            attendanceStats={participantStats.attendance_stats}
          />
        )}

        {/* 학습 진행 현황 */}
        {participantStats.learning_stats && (
          <CampParticipantLearningProgress
            templateId={template.id}
            studentId={studentId}
            learningStats={participantStats.learning_stats}
          />
        )}
      </div>
    </section>
  );
}

