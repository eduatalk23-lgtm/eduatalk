import type { ScoreTypeComparison as ScoreTypeComparisonData } from "../_utils";

type ScoreTypeComparisonProps = {
  data: ScoreTypeComparisonData[];
};

export function ScoreTypeComparison({ data }: ScoreTypeComparisonProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
        데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {data.map((item) => (
        <div
          key={item.score_type}
          className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h3 className="text-lg font-semibold text-gray-900">
            {item.score_type}
          </h3>
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-xs text-gray-500">평균 등급</p>
              <p className="text-2xl font-bold text-indigo-600">
                {item.averageGrade.toFixed(1)}등급
              </p>
            </div>
            {item.averageRawScore > 0 && (
              <div>
                <p className="text-xs text-gray-500">평균 원점수</p>
                <p className="text-xl font-semibold text-gray-900">
                  {item.averageRawScore.toFixed(1)}점
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">성적 개수</p>
              <p className="text-sm text-gray-700">{item.count}개</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

