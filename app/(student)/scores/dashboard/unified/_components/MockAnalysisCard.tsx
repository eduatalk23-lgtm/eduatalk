import { Card, CardHeader } from "@/components/ui/Card";
import type { MockAnalysis } from "@/lib/types/scoreDashboard";

interface MockAnalysisCardProps {
  analysis: MockAnalysis;
}

export function MockAnalysisCard({ analysis }: MockAnalysisCardProps) {
  const { recentExam, avgPercentile, totalStdScore, best3GradeSum } = analysis;

  return (
    <Card>
      <CardHeader
        title="모의고사 분석"
        description="최근 모의고사 성적 요약"
      />

      {/* 최근 시험 정보 */}
      <div className="mt-4">
        {recentExam ? (
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="mb-1 text-xs font-medium text-blue-700">
              최근 시험
            </div>
            <div className="text-base font-bold text-blue-900">
              {recentExam.examTitle}
            </div>
            <div className="mt-1 text-xs text-blue-600">
              {recentExam.examDate}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-500">
              최근 모의고사 데이터가 없습니다
            </p>
          </div>
        )}
      </div>

      {/* 주요 지표 */}
      <div className="mt-4 flex flex-col gap-3">
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
        <div className="mt-4 rounded-lg bg-yellow-50 p-3">
          <p className="text-xs text-yellow-800">
            모의고사 성적 데이터가 없습니다. 성적을 입력해주세요.
          </p>
        </div>
      )}
    </Card>
  );
}

