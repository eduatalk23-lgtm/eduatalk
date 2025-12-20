"use client";

import Link from "next/link";
import { CampTemplate } from "@/lib/types/plan";
import { useCampAttendanceStats } from "@/lib/hooks/useCampStats";
import { CampAttendanceStatsCards } from "./CampAttendanceStatsCards";
import { CampParticipantAttendanceTable } from "./CampParticipantAttendanceTable";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";

type CampAttendanceDashboardProps = {
  template: CampTemplate;
  templateId: string;
};

export function CampAttendanceDashboard({
  template,
  templateId,
}: CampAttendanceDashboardProps) {
  // 출석 통계 조회 (훅 사용)
  const { data: attendanceStats, isLoading } = useCampAttendanceStats(templateId);
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              출석 관리 - {template.name}
            </h1>
            <p className="text-sm text-gray-500">
              캠프 참여자의 출석 현황을 확인하고 관리하세요.
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
                href={`/admin/camp-templates/${template.id}/participants`}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                참여자 목록
              </Link>
            </div>
          </div>
        </div>

        {/* 캠프 기간 정보 */}
        {template.camp_start_date && template.camp_end_date && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  캠프 시작일
                </label>
                <p className="text-sm text-gray-700">
                  {new Date(template.camp_start_date).toLocaleDateString(
                    "ko-KR"
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  캠프 종료일
                </label>
                <p className="text-sm text-gray-700">
                  {new Date(template.camp_end_date).toLocaleDateString("ko-KR")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 로딩 상태 */}
        {isLoading && <SuspenseFallback />}

        {/* 출석 통계 카드 */}
        {attendanceStats && (
          <CampAttendanceStatsCards stats={attendanceStats} />
        )}

        {/* 참여자별 출석 현황 테이블 */}
        {attendanceStats && (
          <CampParticipantAttendanceTable
            templateId={template.id}
            participantStats={attendanceStats.participant_stats}
          />
        )}

        {!isLoading && !attendanceStats && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-700">
              출석 데이터가 없습니다. 캠프 기간이 설정되어 있는지 확인해주세요.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

