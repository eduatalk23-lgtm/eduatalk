"use client";

import { useState } from "react";
import Link from "next/link";
import { CampTemplate } from "@/lib/types/plan";
import { useCampLearningStats, useCampLearningRecords } from "@/lib/hooks/useCampLearning";
import { CampLearningStatsCards } from "./CampLearningStatsCards";
import { StudentPlanProgressTable } from "./StudentPlanProgressTable";
import { CampLearningCalendar } from "./CampLearningCalendar";
import { DatePlanDetailDialog } from "./DatePlanDetailDialog";
import { StudentSelector } from "./StudentSelector";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";

type CampLearningDashboardProps = {
  template: CampTemplate;
  templateId: string;
};

export function CampLearningDashboard({
  template,
  templateId,
}: CampLearningDashboardProps) {
  // 학습 통계 조회 (훅 사용)
  const { data: learningStats, isLoading } = useCampLearningStats(templateId);
  
  // 선택된 날짜 상태 관리
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // 선택된 학생 필터 상태 관리
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // 캠프 기간 학습 기록 조회 (달력용)
  const { data: learningRecords } = useCampLearningRecords(
    templateId,
    template.camp_start_date || "",
    template.camp_end_date || "",
    {
      enabled: !!template.camp_start_date && !!template.camp_end_date,
    }
  );

  // 날짜 클릭 핸들러
  const handleDateClick = (date: string) => {
    setSelectedDate(date);
  };

  // 학생 선택 핸들러
  const handleStudentSelect = (studentIds: string[]) => {
    setSelectedStudentIds(studentIds);
  };

  // 참여자 목록 추출 (학생 선택 필터용)
  const participantList = learningStats?.participant_stats.map((stat) => ({
    id: stat.student_id,
    name: stat.student_name,
  })) || [];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium text-gray-500">캠프 관리</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              학습 관리 - {template.name}
            </h1>
            <p className="text-sm text-gray-500">
              캠프 참여자의 학습 진행 현황을 확인하고 관리하세요.
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

        {/* 학습 달력 */}
        {template.camp_start_date && template.camp_end_date && learningRecords && (
          <CampLearningCalendar
            startDate={template.camp_start_date}
            endDate={template.camp_end_date}
            learningRecords={learningRecords}
            onDateClick={handleDateClick}
          />
        )}

        {/* 학생 선택 필터 */}
        {participantList.length > 0 && (
          <StudentSelector
            participants={participantList}
            selectedStudentIds={selectedStudentIds}
            onSelectionChange={handleStudentSelect}
          />
        )}

        {/* 로딩 상태 */}
        {isLoading && <SuspenseFallback />}

        {/* 학습 통계 카드 */}
        {learningStats && (
          <CampLearningStatsCards stats={learningStats} template={template} />
        )}

        {/* 학생별 학습 진행 현황 테이블 */}
        {learningStats && (
          <StudentPlanProgressTable
            templateId={template.id}
            participantStats={learningStats.participant_stats}
            selectedStudentIds={selectedStudentIds.length > 0 ? selectedStudentIds : undefined}
          />
        )}

        {!isLoading && !learningStats && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-700">
              학습 데이터가 없습니다. 캠프 기간이 설정되어 있는지 확인해주세요.
            </p>
          </div>
        )}
      </div>

      {/* 날짜별 플랜 상세 다이얼로그 */}
      {template.camp_start_date && template.camp_end_date && (
        <DatePlanDetailDialog
          open={selectedDate !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedDate(null);
            }
          }}
          templateId={templateId}
          date={selectedDate}
          studentIds={selectedStudentIds.length > 0 ? selectedStudentIds : undefined}
        />
      )}
    </section>
  );
}

