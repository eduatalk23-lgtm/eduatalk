"use client";

import { cn } from "@/lib/cn";
import {
  textPrimaryVar,
  textSecondaryVar,
  textTertiaryVar,
  bgSurfaceVar,
  borderDefaultVar,
  getGrayBgClasses,
  getStatusBadgeColorClasses,
  tableHeaderBase,
  tableCellBase,
  tableRowBase,
  divideDefaultVar,
} from "@/lib/utils/darkMode";
import { getGradeColor } from "@/lib/constants/colors";

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
      <div className={cn("text-center py-8", textTertiaryVar)}>
        <p className="text-sm">비교할 성적 데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={cn(getGrayBgClasses("tableHeader"), "border-b", borderDefaultVar)}>
          <tr>
            <th className={tableHeaderBase}>과목</th>
            <th className={tableHeaderBase}>최근 시험</th>
            <th className={tableHeaderBase}>등급</th>
            <th className={tableHeaderBase}>백분위</th>
            <th className={tableHeaderBase}>이전 시험</th>
            <th className={tableHeaderBase}>등급</th>
            <th className={tableHeaderBase}>백분위</th>
            <th className={tableHeaderBase}>변화</th>
          </tr>
        </thead>
        <tbody className={divideDefaultVar}>
          {data.map((subject) => {
            const recentGradeColor = subject.recent_score.grade_score
              ? getGradeColor(subject.recent_score.grade_score)
              : null;
            const previousGradeColor = subject.previous_score?.grade_score
              ? getGradeColor(subject.previous_score.grade_score)
              : null;

            return (
              <tr key={subject.subject_id} className={tableRowBase}>
                <td className={cn(tableCellBase, "font-medium", textPrimaryVar)}>
                  {subject.subject_name}
                </td>
                <td className={cn(tableCellBase, "text-xs", textSecondaryVar)}>
                  {subject.recent_score.exam_title}
                </td>
                <td className={tableCellBase}>
                  {subject.recent_score.grade_score && recentGradeColor ? (
                    <span
                      className={cn(
                        "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                        recentGradeColor.badge
                      )}
                    >
                      {subject.recent_score.grade_score}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className={cn(tableCellBase, textSecondaryVar)}>
                  {subject.recent_score.percentile !== null
                    ? `${subject.recent_score.percentile}%`
                    : "-"}
                </td>
                <td className={cn(tableCellBase, "text-xs", textSecondaryVar)}>
                  {subject.previous_score?.exam_title || "-"}
                </td>
                <td className={tableCellBase}>
                  {subject.previous_score?.grade_score && previousGradeColor ? (
                    <span
                      className={cn(
                        "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                        previousGradeColor.badge
                      )}
                    >
                      {subject.previous_score.grade_score}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className={cn(tableCellBase, textSecondaryVar)}>
                  {subject.previous_score?.percentile != null
                    ? `${subject.previous_score?.percentile}%`
                    : "-"}
                </td>
                <td className={tableCellBase}>
                  <div className="flex flex-col gap-1">
                    {subject.change.grade_change !== null && (
                      <span
                        className={cn(
                          "text-xs font-medium",
                          subject.change.grade_change > 0
                            ? "text-green-600 dark:text-green-400"
                            : subject.change.grade_change < 0
                            ? "text-red-600 dark:text-red-400"
                            : textSecondaryVar
                        )}
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
                        className={cn(
                          "text-xs font-medium",
                          subject.change.percentile_change > 0
                            ? "text-green-600 dark:text-green-400"
                            : subject.change.percentile_change < 0
                            ? "text-red-600 dark:text-red-400"
                            : textSecondaryVar
                        )}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

