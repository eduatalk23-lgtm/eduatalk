import type { SemesterSummary } from "../_utils";

type SemesterSummaryTableProps = {
  data: SemesterSummary[];
};

export function SemesterSummaryTable({
  data,
}: SemesterSummaryTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
        학기별 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
              학기
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
              성적 개수
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
              평균 등급
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
              평균 원점수
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
              교과 목록
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((summary) => (
            <tr key={summary.semester} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {summary.semester}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                {summary.totalScores}개
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                <span className="font-semibold">
                  {summary.averageGrade.toFixed(1)}등급
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                {summary.averageRawScore > 0
                  ? `${summary.averageRawScore.toFixed(1)}점`
                  : "-"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">
                <div className="flex flex-wrap gap-1">
                  {summary.courses.map((course) => (
                    <span
                      key={course}
                      className="rounded bg-gray-100 px-2 py-1 text-xs"
                    >
                      {course}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

