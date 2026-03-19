"use client";

import { useQuery } from "@tanstack/react-query";
import { reportDataQueryOptions } from "@/lib/query-options/studentRecord";
import { ReportSkeleton } from "./ReportSkeleton";
import { CoverSection } from "./sections/CoverSection";
import { ScoreSection } from "./sections/ScoreSection";
import { CompetencySection } from "./sections/CompetencySection";
import { DiagnosisSection } from "./sections/DiagnosisSection";
import { StorylineSection } from "./sections/StorylineSection";
import { MockSection } from "./sections/MockSection";
import { ApplicationSection } from "./sections/ApplicationSection";
import { StrategySection } from "./sections/StrategySection";
import { WarningSection } from "./sections/WarningSection";

interface ReportClientProps {
  studentId: string;
}

export function ReportClient({ studentId }: ReportClientProps) {
  const { data, isLoading, error } = useQuery(
    reportDataQueryOptions(studentId),
  );

  if (isLoading) return <ReportSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-red-600">
          {error?.message ?? "데이터를 불러올 수 없습니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl bg-white px-8 py-6 text-gray-900">
      {/* 인쇄 버튼 (print 시 숨김) */}
      <div className="flex justify-end pb-6 print:hidden" data-print-hide>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          PDF 저장 / 인쇄
        </button>
      </div>

      {/* 1. 표지 */}
      <CoverSection
        studentName={data.student.name}
        schoolName={data.student.schoolName}
        grade={data.student.grade}
        className={data.student.className}
        targetMajor={data.student.targetMajor}
        consultantName={data.consultantName}
        generatedAt={data.generatedAt}
      />

      {/* 2. 교과 성적 분석 */}
      <ScoreSection
        internalAnalysis={data.internalAnalysis}
        internalScores={data.internalScores}
      />

      {/* 3. 역량 분석 (narrative + 근거 활동 포함) */}
      <CompetencySection diagnosisData={data.diagnosisData} />

      {/* 4. 종합 진단 (추천전공 + 이수적합 확장) */}
      <DiagnosisSection diagnosisData={data.diagnosisData} />

      {/* 5. 스토리라인 */}
      <StorylineSection
        storylineData={data.storylineData}
        studentGrade={data.student.grade}
      />

      {/* 6. 모평 분석 */}
      <MockSection mockAnalysis={data.mockAnalysis} />

      {/* 7. 지원 현황 + 수능최저 + 면접 충돌 */}
      <ApplicationSection strategyData={data.strategyData} />

      {/* 8. 보완 전략 */}
      <StrategySection diagnosisData={data.diagnosisData} />

      {/* 9. 점검 사항 (경보) */}
      <WarningSection
        recordDataByGrade={data.recordDataByGrade}
        storylineData={data.storylineData}
        diagnosisData={data.diagnosisData}
        strategyData={data.strategyData}
        studentGrade={data.student.grade}
      />
    </div>
  );
}
