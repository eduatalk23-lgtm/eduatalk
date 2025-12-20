import type { WeakSubject } from "../_utils";

type WeakSubjectsListProps = {
  data: WeakSubject[];
};

export function WeakSubjectsList({ data }: WeakSubjectsListProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
        취약과목이 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm min-h-[300px]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                교과
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                세부 과목
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                평균 등급
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                취약 사유
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                성적 개수
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((subject, index) => (
              <tr
                key={`${subject.course}:${subject.course_detail}`}
                className="hover:bg-gray-50"
              >
                <td className="px-4 py-3 text-sm text-gray-700">
                  {subject.course}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {subject.course_detail}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="font-semibold text-red-600">
                    {subject.averageGrade.toFixed(1)}등급
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <span className="inline-block rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                    {subject.reason}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {subject.count}개
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

