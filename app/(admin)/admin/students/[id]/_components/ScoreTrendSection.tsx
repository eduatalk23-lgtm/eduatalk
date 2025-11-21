import { getStudentScoreTrendForAdmin } from "@/lib/data/admin/studentData";

export async function ScoreTrendSection({ studentId }: { studentId: string }) {
  try {
    const scoreTrend = await getStudentScoreTrendForAdmin(studentId);

    // 과목별로 그룹화하여 최신 성적 추이 표시
    const subjectMap = new Map<
      string,
      Array<{
        date: string;
        grade: number;
        type: "school" | "mock";
        examType?: string;
      }>
    >();

    scoreTrend.schoolScores.forEach((score: any) => {
      const subject = score.subject_name ?? "미분류";
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, []);
      }
      subjectMap.get(subject)!.push({
        date: score.test_date ?? "",
        grade: score.grade_score ?? 0,
        type: "school",
      });
    });

    scoreTrend.mockScores.forEach((score: any) => {
      const subject = score.subject_name ?? "미분류";
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, []);
      }
      subjectMap.get(subject)!.push({
        date: score.test_date ?? "",
        grade: score.grade_score ?? 0,
        type: "mock",
        examType: score.exam_type ?? undefined,
      });
    });

    // 최근 성적이 있는 과목만 표시 (최대 5개)
    const topSubjects = Array.from(subjectMap.entries())
      .map(([subject, scores]) => ({
        subject,
        scores: scores.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        latestScore: scores[0],
      }))
      .filter((item) => item.latestScore.date)
      .sort((a, b) => new Date(b.latestScore.date).getTime() - new Date(a.latestScore.date).getTime())
      .slice(0, 5);

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">성적 변화 조회</h2>

        {/* 통계 */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-indigo-50 p-4">
            <div className="text-sm text-indigo-600">내신 성적</div>
            <div className="mt-1 text-2xl font-bold text-indigo-700">
              {scoreTrend.schoolScores.length}건
            </div>
          </div>
          <div className="rounded-lg bg-purple-50 p-4">
            <div className="text-sm text-purple-600">모의고사 성적</div>
            <div className="mt-1 text-2xl font-bold text-purple-700">
              {scoreTrend.mockScores.length}건
            </div>
          </div>
        </div>

        {/* 과목별 최신 성적 */}
        {topSubjects.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 성적이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">과목별 최신 성적</h3>
            {topSubjects.map((item) => {
              const trend = item.scores.length >= 2
                ? item.scores[0].grade - item.scores[1].grade
                : 0;
              const trendColor =
                trend < 0 ? "text-green-600" : trend > 0 ? "text-red-600" : "text-gray-600";
              const trendIcon = trend < 0 ? "↑" : trend > 0 ? "↓" : "→";

              return (
                <div
                  key={item.subject}
                  className="rounded-lg border border-gray-200 p-4 transition hover:bg-gray-50"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-gray-900">{item.subject}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900">
                        {item.latestScore.grade}등급
                      </span>
                      {trend !== 0 && (
                        <span className={`text-sm font-semibold ${trendColor}`}>
                          {trendIcon} {Math.abs(trend)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>
                      {new Date(item.latestScore.date).toLocaleDateString("ko-KR")}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">
                      {item.latestScore.type === "school" ? "내신" : "모의고사"}
                      {item.latestScore.examType && ` (${item.latestScore.examType})`}
                    </span>
                  </div>
                  {item.scores.length > 1 && (
                    <div className="mt-2 text-xs text-gray-500">
                      최근 {item.scores.length}회 평균:{" "}
                      {(
                        item.scores.slice(0, 3).reduce((sum, s) => sum + s.grade, 0) /
                        Math.min(3, item.scores.length)
                      ).toFixed(1)}등급
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("[ScoreTrendSection] 성적 변화 조회 실패", error);
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6">
        <p className="text-sm text-gray-500">성적 정보를 불러오는 중 오류가 발생했습니다.</p>
      </div>
    );
  }
}

