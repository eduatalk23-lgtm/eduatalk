"use client";

import { useMemo } from "react";
import { analyzeMockTrend, compareTwoRecentMockScores } from "@/lib/analysis/scoreAnalyzer";
import { enrichMockScores } from "@/lib/utils/scoreTransform";
import type { MockScoreWithRelations } from "@/lib/types/scoreAnalysis";
import MockTrendChart from "./MockTrendChart";
import MockComparisonTable from "./MockComparisonTable";

type MockDetailAnalysisProps = {
  studentId: string;
  tenantId: string;
  scores: MockScoreWithRelations[];
};

export default function MockDetailAnalysis({
  studentId,
  tenantId,
  scores,
}: MockDetailAnalysisProps) {
  // 중복 제거: 한 번만 변환
  const enrichedScores = useMemo(
    () => enrichMockScores(scores),
    [scores]
  );

  // 백분위 추이 분석
  const trendAnalysis = useMemo(() => analyzeMockTrend(enrichedScores), [enrichedScores]);

  // 최근 2회 비교
  const recentComparison = useMemo(() => {
    return compareTwoRecentMockScores(enrichedScores);
  }, [enrichedScores]);

  // 시간순 정렬된 데이터 (차트용)
  const sortedScores = useMemo(() => {
    return [...enrichedScores].sort(
      (a, b) =>
        new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
    );
  }, [enrichedScores]);

  if (scores.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12">
        <div className="flex flex-col gap-2 text-center">
          <p className="text-gray-600">모의고사 성적 데이터가 없습니다.</p>
          <p className="text-sm text-gray-500">
            성적 입력 페이지에서 성적을 입력하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 추이 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1 bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">전체 시험 수</p>
          <p className="text-2xl font-bold text-gray-900">
            {enrichedScores.length}
          </p>
        </div>
        <div className="flex flex-col gap-1 bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">최근 평균 백분위</p>
          <p className="text-2xl font-bold text-indigo-600">
            {trendAnalysis.recent_average_percentile !== null
              ? `${trendAnalysis.recent_average_percentile}%`
              : "N/A"}
          </p>
        </div>
        <div className="flex flex-col gap-1 bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">추이</p>
          <p
            className={`text-2xl font-bold ${
              trendAnalysis.trend === "상승"
                ? "text-green-600"
                : trendAnalysis.trend === "하락"
                ? "text-red-600"
                : "text-gray-600"
            }`}
          >
            {trendAnalysis.trend}
            {trendAnalysis.change_from_previous !== null &&
              ` (${trendAnalysis.change_from_previous > 0 ? "+" : ""}${trendAnalysis.change_from_previous})`}
          </p>
        </div>
      </div>

      {/* 백분위 추이 차트 */}
      <div className="flex flex-col gap-4 bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          백분위 추이
        </h2>
        <MockTrendChart scores={sortedScores} />
      </div>

      {/* 최근 2회 비교 테이블 */}
      {recentComparison.length > 0 && (
        <div className="flex flex-col gap-4 bg-white rounded-lg border border-gray-200 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            최근 2회 성적 비교
          </h2>
          <MockComparisonTable data={recentComparison} />
        </div>
      )}

      {/* 과목별 상세 성적 */}
      <div className="flex flex-col gap-4 bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          시험별 상세 성적
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  시험일
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  시험명
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  과목
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  등급
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  백분위
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  표준점수
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedScores.map((score, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    {new Date(score.exam_date).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {score.exam_title}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {score.subject_name || "알 수 없음"}
                  </td>
                  <td className="px-4 py-3">
                    {score.grade_score ? (
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          score.grade_score <= 2
                            ? "bg-green-100 text-green-800"
                            : score.grade_score <= 4
                            ? "bg-blue-100 text-blue-800"
                            : score.grade_score <= 6
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {score.grade_score}등급
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {score.percentile !== null ? `${score.percentile}%` : "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {score.standard_score !== null ? score.standard_score : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

