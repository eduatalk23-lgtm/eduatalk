import type { MockAnalysis } from "@/lib/scores/mockAnalysis";

interface MockSectionProps {
  mockAnalysis: MockAnalysis;
}

export function MockSection({ mockAnalysis }: MockSectionProps) {
  const { recentExam, avgPercentile, totalStdScore, best3GradeSum } =
    mockAnalysis;

  const hasData = recentExam || avgPercentile != null || totalStdScore != null;

  return (
    <section className="print-break-before">
      <h2 className="mb-4 border-b-2 border-gray-800 pb-2 text-xl font-bold text-gray-900">
        모의고사 분석
      </h2>

      {!hasData ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">모의고사 데이터가 입력되지 않았습니다.</p>
          <p className="mt-1 text-xs text-gray-400">모의고사 성적을 입력하면 백분위 추이와 배치 분석이 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recentExam && (
            <p className="text-sm text-gray-600">
              최근 시험: {recentExam.examTitle} ({recentExam.examDate})
            </p>
          )}

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-gray-700">
                  항목
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-700">
                  수치
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">
                  설명
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="px-3 py-2 font-medium">평균 백분위</td>
                <td className="px-3 py-2 text-right">
                  {avgPercentile != null
                    ? `${avgPercentile.toFixed(1)}%`
                    : "-"}
                </td>
                <td className="px-3 py-2 text-gray-500">
                  국/수/탐(상위2) 평균
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="px-3 py-2 font-medium">표준점수 합</td>
                <td className="px-3 py-2 text-right">
                  {totalStdScore != null ? totalStdScore : "-"}
                </td>
                <td className="px-3 py-2 text-gray-500">
                  국/수/탐(상위2) 합산
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="px-3 py-2 font-medium">상위 3개 등급합</td>
                <td className="px-3 py-2 text-right">
                  {best3GradeSum != null ? best3GradeSum : "-"}
                </td>
                <td className="px-3 py-2 text-gray-500">
                  국·수·영·탐 중 상위 3개
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
