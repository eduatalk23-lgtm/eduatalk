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
            <p className="text-xs text-gray-500">
              기준 시험: {recentExam.examTitle} ({recentExam.examDate})
            </p>
          )}

          <div className="grid grid-cols-3 gap-3 print-avoid-break">
            <div className="rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-[10px] font-medium text-gray-500">평균 백분위</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {avgPercentile != null ? `${avgPercentile.toFixed(1)}%` : "-"}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-400">국/수/탐(상위2)</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-[10px] font-medium text-gray-500">표준점수 합</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {totalStdScore ?? "-"}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-400">국/수/탐(상위2)</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-[10px] font-medium text-gray-500">상위 3과목 등급합</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {best3GradeSum ?? "-"}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-400">국·수·영·탐 중</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
