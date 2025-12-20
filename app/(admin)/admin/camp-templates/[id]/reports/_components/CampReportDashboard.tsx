"use client";

import Link from "next/link";
import { CampTemplate } from "@/lib/types/plan";
import { useCampStats } from "@/lib/hooks/useCampStats";
import { CampReportSummaryCards } from "./CampReportSummaryCards";
import { CampAttendanceReportSection } from "./CampAttendanceReportSection";
import { CampLearningReportSection } from "./CampLearningReportSection";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";

type CampReportDashboardProps = {
  template: CampTemplate;
  templateId: string;
};

export function CampReportDashboard({
  template,
  templateId,
}: CampReportDashboardProps) {
  // 캠프 통계 조회 (훅 사용)
  const { attendance, learning, isLoading } = useCampStats(templateId);

  const attendanceStats = attendance.data;
  const learningStats = learning.data;
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              리포트 - {template.name}
            </h1>
            <p className="text-sm text-gray-500">
              캠프 참여자의 출석 및 학습 통계를 확인하세요.
            </p>
          </div>

          {/* 버튼 영역 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/admin/camp-templates/${template.id}`}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              ← 템플릿 상세
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/admin/camp-templates/${template.id}/attendance`}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                출석 관리
              </Link>
              <Link
                href={`/admin/camp-templates/${template.id}/participants`}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                참여자 목록
              </Link>
            </div>
          </div>
        </div>

        {/* 로딩 상태 */}
        {isLoading && <SuspenseFallback />}

        {/* 리포트 요약 카드 */}
        {attendanceStats && learningStats && (
          <CampReportSummaryCards
            attendanceStats={attendanceStats}
            learningStats={learningStats}
          />
        )}

        {/* 출석 리포트 섹션 */}
        {attendanceStats && (
          <CampAttendanceReportSection attendanceStats={attendanceStats} />
        )}

        {/* 학습 리포트 섹션 */}
        {learningStats && (
          <CampLearningReportSection learningStats={learningStats} />
        )}

        {!isLoading && !attendanceStats && !learningStats && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-700">
              리포트 데이터가 없습니다. 캠프 기간이 설정되어 있고 참여자가 있는지 확인해주세요.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

