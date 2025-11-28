"use client";

type MockComparisonTableProps = {
  data: Array<{
    subject_id: string;
    subject_name: string;
    recent_score: {
      exam_title: string;
      grade_score: number | null;
      percentile: number | null;
    };
    previous_score: {
      exam_title: string;
      grade_score: number | null;
      percentile: number | null;
    } | null;
    change: {
      grade_change: number | null;
      percentile_change: number | null;
    };
  }>;
};

export default function MockComparisonTable({ data }: MockComparisonTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">비교할 성적 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              과목
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              최근 시험
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              등급
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              백분위
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              이전 시험
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              등급
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              백분위
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              변화
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((subject) => (
            <tr key={subject.subject_id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900 font-medium">
                {subject.subject_name}
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">
                {subject.recent_score.exam_title}
              </td>
              <td className="px-4 py-3">
                {subject.recent_score.grade_score ? (
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      subject.recent_score.grade_score <= 2
                        ? "bg-green-100 text-green-800"
                        : subject.recent_score.grade_score <= 4
                        ? "bg-blue-100 text-blue-800"
                        : subject.recent_score.grade_score <= 6
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {subject.recent_score.grade_score}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {subject.recent_score.percentile !== null
                  ? `${subject.recent_score.percentile}%`
                  : "-"}
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">
                {subject.previous_score?.exam_title || "-"}
              </td>
              <td className="px-4 py-3">
                {subject.previous_score?.grade_score ? (
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      subject.previous_score.grade_score <= 2
                        ? "bg-green-100 text-green-800"
                        : subject.previous_score.grade_score <= 4
                        ? "bg-blue-100 text-blue-800"
                        : subject.previous_score.grade_score <= 6
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {subject.previous_score.grade_score}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {subject.previous_score?.percentile !== null
                  ? `${subject.previous_score.percentile}%`
                  : "-"}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  {subject.change.grade_change !== null && (
                    <span
                      className={`text-xs font-medium ${
                        subject.change.grade_change > 0
                          ? "text-green-600"
                          : subject.change.grade_change < 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      등급:{" "}
                      {subject.change.grade_change > 0
                        ? `↑${subject.change.grade_change}`
                        : subject.change.grade_change < 0
                        ? `↓${Math.abs(subject.change.grade_change)}`
                        : "="}
                    </span>
                  )}
                  {subject.change.percentile_change !== null && (
                    <span
                      className={`text-xs font-medium ${
                        subject.change.percentile_change > 0
                          ? "text-green-600"
                          : subject.change.percentile_change < 0
                          ? "text-red-600"
                          : "text-gray-600"
                      }`}
                    >
                      백분위:{" "}
                      {subject.change.percentile_change > 0
                        ? `+${subject.change.percentile_change.toFixed(1)}`
                        : subject.change.percentile_change.toFixed(1)}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

