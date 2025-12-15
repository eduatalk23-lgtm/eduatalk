import type { ScoreRow } from "@/app/(student)/scores/dashboard/_utils";
import { cn } from "@/lib/cn";
import {
  bgSurface,
  bgPage,
  textPrimary,
  textSecondary,
  textMuted,
  borderDefault,
} from "@/lib/utils/darkMode";

type RecentScoresProps = {
  scores: ScoreRow[];
};

export function RecentScores({ scores }: RecentScoresProps) {
  return (
    <div className={cn(
      "flex flex-col gap-4 rounded-xl border p-6 shadow-sm",
      borderDefault,
      bgSurface
    )}>
      <h3 className={cn("text-lg font-semibold", textPrimary)}>
        최근 성적 변화
      </h3>
      <div className="flex flex-col gap-3">
        {scores.map((score, index) => {
          const prevScore = index < scores.length - 1 ? scores[index + 1] : null;
          const gradeChange =
            prevScore && score.grade !== null && prevScore.grade !== null
              ? score.grade - prevScore.grade
              : null;

          return (
            <div
              key={score.id}
              className={cn(
                "flex items-center justify-between rounded-lg border p-3",
                "border-gray-100 dark:border-gray-800",
                bgPage
              )}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-medium", textPrimary)}>
                    {score.course_detail || score.course || "과목"}
                  </span>
                  {score.test_date && (
                    <span className={cn("text-xs", textMuted)}>
                      ({new Date(score.test_date).toLocaleDateString("ko-KR")})
                    </span>
                  )}
                </div>
                {score.semester && (
                  <span className={cn("text-xs", textMuted)}>{score.semester}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {score.grade !== null && (
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {score.grade}등급
                  </span>
                )}
                {gradeChange !== null && gradeChange !== 0 && (
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      gradeChange < 0
                        ? "text-green-600 dark:text-green-400"
                        : gradeChange > 0
                        ? "text-red-600 dark:text-red-400"
                        : textSecondary
                    )}
                  >
                    {gradeChange < 0 ? "↑" : "↓"} {Math.abs(gradeChange)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

