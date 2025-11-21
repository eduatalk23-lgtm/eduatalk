import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export async function ScoreSummarySection({ studentId }: { studentId: string }) {
  const supabase = await createSupabaseServerClient();

  // 최근 내신 성적 조회
  const { data: schoolScores } = await supabase
    .from("student_school_scores")
    .select("subject_group,grade_score,test_date")
    .eq("student_id", studentId)
    .order("test_date", { ascending: false })
    .limit(10);

  // 최근 모의고사 성적 조회
  const { data: mockScores } = await supabase
    .from("student_mock_scores")
    .select("subject_group,grade_score,test_date,exam_type")
    .eq("student_id", studentId)
    .order("test_date", { ascending: false })
    .limit(10);

  const schoolScoreRows = (schoolScores ?? []) as Array<{
    subject_group?: string | null;
    grade_score?: number | null;
    test_date?: string | null;
  }>;

  const mockScoreRows = (mockScores ?? []) as Array<{
    subject_group?: string | null;
    grade_score?: number | null;
    test_date?: string | null;
    exam_type?: string | null;
  }>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">성적 요약</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-700">최근 내신</h3>
          {schoolScoreRows.length === 0 ? (
            <p className="text-sm text-gray-500">내신 성적이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {schoolScoreRows.slice(0, 5).map((score, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{score.subject_group ?? "-"}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {score.grade_score ?? "-"}등급
                    </span>
                    {score.test_date && (
                      <span className="text-xs text-gray-500">
                        {new Date(score.test_date).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-700">최근 모의고사</h3>
          {mockScoreRows.length === 0 ? (
            <p className="text-sm text-gray-500">모의고사 성적이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {mockScoreRows.slice(0, 5).map((score, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {score.subject_group ?? "-"} ({score.exam_type ?? "-"})
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {score.grade_score ?? "-"}등급
                    </span>
                    {score.test_date && (
                      <span className="text-xs text-gray-500">
                        {new Date(score.test_date).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

