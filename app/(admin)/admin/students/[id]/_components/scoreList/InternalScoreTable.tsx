"use client";

import type { InternalScoreWithRelations } from "@/lib/types/scoreAnalysis";
import { cn } from "@/lib/cn";

function gradeBadgeColor(grade: number | null): string {
  if (grade === null) return "bg-gray-100 text-gray-500";
  if (grade === 1) return "bg-blue-100 text-blue-700";
  if (grade === 2) return "bg-green-100 text-green-700";
  if (grade === 3) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-500";
}

type InternalScoreTableProps = {
  scores: InternalScoreWithRelations[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onRowClick: (score: InternalScoreWithRelations) => void;
  editingId: string | null;
  gradeSystem: 5 | 9;
};

export function InternalScoreTable({
  scores,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onRowClick,
  editingId,
  gradeSystem,
}: InternalScoreTableProps) {
  const allSelected = scores.length > 0 && scores.every((s) => selectedIds.has(s.id));
  const is5Grade = gradeSystem === 5;

  if (scores.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        등록된 내신 성적이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            <th className="w-10 px-3 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                className="size-4 rounded border-gray-300"
              />
            </th>
            <th className="px-3 py-3 font-medium text-gray-600">교과군</th>
            <th className="px-3 py-3 font-medium text-gray-600">과목명</th>
            <th className="px-3 py-3 font-medium text-gray-600">과목유형</th>
            <th className="px-3 py-3 text-right font-medium text-gray-600">이수단위</th>
            <th className="px-3 py-3 text-right font-medium text-gray-600">원점수</th>
            <th className="px-3 py-3 text-right font-medium text-gray-600">과목평균</th>
            <th className="px-3 py-3 text-right font-medium text-gray-600">표준편차</th>
            <th className="px-3 py-3 text-center font-medium text-gray-600">석차등급</th>
            <th className="px-3 py-3 text-center font-medium text-gray-600">성취도</th>
            <th className="px-3 py-3 text-right font-medium text-gray-600">{is5Grade ? "추정백분위" : "백분위"}</th>
            <th className="px-3 py-3 text-right font-medium text-gray-600">{is5Grade ? "9등급환산(추정)" : "조정/변환등급"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {scores.map((score) => {
            const isAchievementOnly =
              score.rank_grade === null && score.std_dev === null;
            return (
              <tr
                key={score.id}
                onClick={() => onRowClick(score)}
                className={cn(
                  "cursor-pointer transition hover:bg-indigo-50/50",
                  editingId === score.id && "bg-indigo-50"
                )}
              >
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(score.id)}
                    onChange={() => onToggleSelect(score.id)}
                    className="size-4 rounded border-gray-300"
                  />
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {score.subject_group?.name ?? "-"}
                  </span>
                </td>
                <td className="px-3 py-3 font-medium text-gray-900">
                  {score.subject?.name ?? "-"}
                </td>
                <td className="px-3 py-3 text-gray-600">
                  {isAchievementOnly ? (
                    <span className="inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                      P/F
                    </span>
                  ) : (
                    score.subject_type?.name ?? "-"
                  )}
                </td>
                <td className="px-3 py-3 text-right text-gray-700">
                  {score.credit_hours}
                </td>
                <td className="px-3 py-3 text-right text-gray-700">
                  {isAchievementOnly ? "-" : (score.raw_score ?? "-")}
                </td>
                <td className="px-3 py-3 text-right text-gray-700">
                  {score.avg_score ?? "-"}
                </td>
                <td className="px-3 py-3 text-right text-gray-700">
                  {score.std_dev ?? "-"}
                </td>
                <td className="px-3 py-3 text-center">
                  {isAchievementOnly ? (
                    "-"
                  ) : (
                    <span
                      className={cn(
                        "inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
                        gradeBadgeColor(score.rank_grade)
                      )}
                    >
                      {score.rank_grade ?? "-"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-center text-gray-700">
                  {score.achievement_level ?? "-"}
                </td>
                <td className="px-3 py-3 text-right text-gray-700">
                  {score.estimated_percentile != null
                    ? `상위 ${(score.estimated_percentile * 100).toFixed(1)}%`
                    : "-"}
                </td>
                <td className="px-3 py-3 text-right">
                  {score.converted_grade_9 != null ? (
                    <span
                      className={cn(
                        "inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
                        gradeBadgeColor(score.converted_grade_9)
                      )}
                    >
                      {score.converted_grade_9}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
