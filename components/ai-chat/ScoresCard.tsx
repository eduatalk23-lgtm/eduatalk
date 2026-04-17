import { cn } from "@/lib/cn";
import type { GetScoresOutput } from "@/app/api/chat/route";

type Props = {
  output: GetScoresOutput;
};

function gradeLabel(g: number | null): string {
  if (g == null) return "-";
  return `${g}등급`;
}

function gradeColor(g: number | null): string {
  if (g == null) return "bg-gray-100 text-gray-500";
  if (g <= 2) return "bg-emerald-100 text-emerald-700";
  if (g <= 4) return "bg-blue-100 text-blue-700";
  if (g <= 6) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export function ScoresCard({ output }: Props) {
  if (!output.ok) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <p className="text-xs font-medium text-rose-600">성적 조회 실패</p>
        <p className="mt-1">{output.reason}</p>
      </div>
    );
  }

  const { studentName, filter, count, rows } = output;
  const filterLabel = [
    filter.grade ? `${filter.grade}학년` : null,
    filter.semester ? `${filter.semester}학기` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "전체 학기";

  if (count === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        <p className="text-xs font-medium text-gray-500">내신 성적 조회</p>
        <p className="mt-1">
          {filterLabel}에 입력된 성적이 없습니다.
        </p>
      </div>
    );
  }

  // 평균 등급(가중 평균) 계산
  const validGrades = rows.filter((r) => r.rankGrade != null);
  const avgGrade =
    validGrades.length > 0
      ? (
          validGrades.reduce(
            (sum, r) => sum + (r.rankGrade ?? 0) * r.creditHours,
            0,
          ) /
          validGrades.reduce((sum, r) => sum + r.creditHours, 0)
        ).toFixed(2)
      : null;

  return (
    <div className="flex flex-col gap-3 overflow-hidden rounded-xl border border-blue-200 bg-white">
      <header className="flex items-center justify-between gap-4 border-b border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-blue-600">내신 성적</p>
          <p className="text-sm font-semibold text-blue-900">
            {studentName ? `${studentName} · ` : ""}
            {filterLabel}
          </p>
        </div>
        {avgGrade && (
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-blue-600">가중평균</span>
            <span className="text-lg font-bold text-blue-900">
              {avgGrade}
            </span>
          </div>
        )}
      </header>

      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">학년/학기</th>
              <th className="px-4 py-2 text-left font-medium">과목</th>
              <th className="px-4 py-2 text-right font-medium">원점수</th>
              <th className="px-4 py-2 text-right font-medium">등급</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-t border-gray-100 text-gray-900"
              >
                <td className="px-4 py-2 text-xs text-gray-500">
                  {r.grade}-{r.semester}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{r.subject}</span>
                    <span className="text-xs text-gray-500">
                      {r.subjectGroup}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right font-mono text-sm">
                  {r.rawScore != null ? r.rawScore : "-"}
                </td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={cn(
                      "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                      gradeColor(r.rankGrade),
                    )}
                  >
                    {gradeLabel(r.rankGrade)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
        <span>총 {count}과목</span>
      </footer>
    </div>
  );
}
