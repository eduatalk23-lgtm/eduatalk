"use client";

import type { MockScoreWithRelations } from "@/lib/types/scoreAnalysis";
import { cn } from "@/lib/cn";

function gradeBadgeColor(grade: number | null): string {
  if (grade === null) return "bg-gray-100 text-gray-500";
  if (grade === 1) return "bg-blue-100 text-blue-700";
  if (grade === 2) return "bg-green-100 text-green-700";
  if (grade === 3) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-500";
}

type MockScoreTableProps = {
  scores: MockScoreWithRelations[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onRowClick: (score: MockScoreWithRelations) => void;
  editingId: string | null;
};

export function MockScoreTable({
  scores,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onRowClick,
  editingId,
}: MockScoreTableProps) {
  const allSelected = scores.length > 0 && scores.every((s) => selectedIds.has(s.id));

  if (scores.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        등록된 모의고사 성적이 없습니다.
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
            <th className="px-3 py-3 font-medium text-gray-600">시험명</th>
            <th className="px-3 py-3 font-medium text-gray-600">시험일자</th>
            <th className="px-3 py-3 font-medium text-gray-600">교과군</th>
            <th className="px-3 py-3 font-medium text-gray-600">과목명</th>
            <th className="px-3 py-3 text-right font-medium text-gray-600">원점수</th>
            <th className="px-3 py-3 text-right font-medium text-gray-600">표준점수</th>
            <th className="px-3 py-3 text-right font-medium text-gray-600">백분위</th>
            <th className="px-3 py-3 text-center font-medium text-gray-600">등급</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {scores.map((score) => (
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
              <td className="px-3 py-3 font-medium text-gray-900">
                {score.exam_title}
              </td>
              <td className="px-3 py-3 text-gray-600">{score.exam_date}</td>
              <td className="px-3 py-3">
                <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {score.subject_group?.name ?? "-"}
                </span>
              </td>
              <td className="px-3 py-3 text-gray-700">
                {score.subject?.name ?? "-"}
              </td>
              <td className="px-3 py-3 text-right text-gray-700">
                {score.raw_score ?? "-"}
              </td>
              <td className="px-3 py-3 text-right text-gray-700">
                {score.standard_score ?? "-"}
              </td>
              <td className="px-3 py-3 text-right text-gray-700">
                {score.percentile ?? "-"}
              </td>
              <td className="px-3 py-3 text-center">
                <span
                  className={cn(
                    "inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
                    gradeBadgeColor(score.grade_score)
                  )}
                >
                  {score.grade_score ?? "-"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
