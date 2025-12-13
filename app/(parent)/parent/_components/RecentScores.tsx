import type { ScoreRow } from "@/app/(student)/scores/dashboard/_utils";

type RecentScoresProps = {
  scores: ScoreRow[];
};

export function RecentScores({ scores }: RecentScoresProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">
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
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {score.course_detail || score.course || "과목"}
                  </span>
                  {score.test_date && (
                    <span className="text-xs text-gray-500">
                      ({new Date(score.test_date).toLocaleDateString("ko-KR")})
                    </span>
                  )}
                </div>
                {score.semester && (
                  <span className="text-xs text-gray-500">{score.semester}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {score.grade !== null && (
                  <span className="text-lg font-bold text-indigo-600">
                    {score.grade}등급
                  </span>
                )}
                {gradeChange !== null && gradeChange !== 0 && (
                  <span
                    className={`text-sm font-semibold ${
                      gradeChange < 0
                        ? "text-green-600"
                        : gradeChange > 0
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
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

