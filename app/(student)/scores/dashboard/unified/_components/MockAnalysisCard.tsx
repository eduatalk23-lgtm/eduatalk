import { SectionCard } from "@/components/ui/SectionCard";
import type { MockAnalysis } from "@/lib/types/scoreDashboard";
import { InfoMessage } from "./InfoMessage";

interface MockAnalysisCardProps {
  analysis: MockAnalysis;
}

export function MockAnalysisCard({ analysis }: MockAnalysisCardProps) {
  const { recentExam, avgPercentile, totalStdScore, best3GradeSum } = analysis;

  return (
    <SectionCard
      title="모의고사 분석"
      description="최근 모의고사 성적 요약"
    >
      {/* 최근 시험 정보 */}
      {recentExam ? (
        <div className="flex flex-col gap-1 rounded-lg bg-blue-50 p-4">
          <div className="text-xs font-medium text-blue-700">최근 시험</div>
          <div className="text-base font-bold text-blue-900">
            {recentExam.examTitle}
          </div>
          <div className="text-xs text-blue-600">{recentExam.examDate}</div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-500">
            최근 모의고사 데이터가 없습니다
          </p>
        </div>
      )}

      {/* 주요 지표 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="text-sm font-medium text-gray-700">평균 백분위</div>
          <div className="text-lg font-bold text-gray-900">
            {avgPercentile !== null ? `${avgPercentile.toFixed(1)}%` : "N/A"}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="text-sm font-medium text-gray-700">
            표준점수 합계
          </div>
          <div className="text-lg font-bold text-gray-900">
            {totalStdScore !== null ? totalStdScore.toFixed(0) : "N/A"}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="text-sm font-medium text-gray-700">
            상위 3개 등급 합
          </div>
          <div className="text-lg font-bold text-gray-900">
            {best3GradeSum !== null ? best3GradeSum : "N/A"}
          </div>
        </div>
      </div>

      {/* 안내 메시지 */}
      {!recentExam && avgPercentile === null && (
        <InfoMessage
          message="모의고사 성적 데이터가 없습니다. 성적을 입력해주세요."
          variant="warning"
        />
      )}
    </SectionCard>
  );
}

