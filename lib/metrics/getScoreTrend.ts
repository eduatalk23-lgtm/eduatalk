import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeQueryArray } from "@/lib/supabase/safeQuery";
import { SCORE_CONSTANTS, SCORE_TREND_CONSTANTS } from "@/lib/metrics/constants";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type ScoreRow = {
  subject_group: string | null;
  grade_score: number | null;
  test_date: string | null;
};

export type ScoreTrendMetrics = {
  hasDecliningTrend: boolean; // 최근 2회 연속 등급 하락
  decliningSubjects: string[]; // 하락한 과목 목록
  lowGradeSubjects: string[]; // 7등급 이하 과목 목록
  recentScores: Array<{
    subject: string;
    scoreType: string; // "school" | "mock"
    grade: number;
    testDate: string;
  }>;
};

/**
 * 성적 추이 메트릭 조회
 */
export async function getScoreTrend(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<ScoreTrendMetrics> {
  try {
    // 내신 성적 및 모의고사 성적 병렬 조회
    const [schoolRows, mockRows] = await Promise.all([
      safeQueryArray<ScoreRow>(
        () =>
          supabase
            .from("student_school_scores")
            .select("subject_group,grade_score,test_date")
            .eq("student_id", studentId)
            .order("test_date", { ascending: false })
            .limit(SCORE_TREND_CONSTANTS.RECENT_SCORES_LIMIT),
        () =>
          supabase
            .from("student_school_scores")
            .select("subject_group,grade_score,test_date")
            .order("test_date", { ascending: false })
            .limit(SCORE_TREND_CONSTANTS.RECENT_SCORES_LIMIT),
        { context: "[metrics/getScoreTrend] 내신 성적 조회" }
      ),
      safeQueryArray<ScoreRow>(
        () =>
          supabase
            .from("student_mock_scores")
            .select("subject_group,grade_score,test_date")
            .eq("student_id", studentId)
            .order("test_date", { ascending: false })
            .limit(SCORE_TREND_CONSTANTS.RECENT_SCORES_LIMIT),
        () =>
          supabase
            .from("student_mock_scores")
            .select("subject_group,grade_score,test_date")
            .order("test_date", { ascending: false })
            .limit(SCORE_TREND_CONSTANTS.RECENT_SCORES_LIMIT),
        { context: "[metrics/getScoreTrend] 모의고사 성적 조회" }
      ),
    ]);

    // 모든 성적을 하나의 배열로 합치기
    const allScores: Array<{
      subject: string;
      scoreType: "school" | "mock";
      grade: number;
      testDate: string;
    }> = [];

    schoolRows.forEach((row) => {
      if (row.subject_group && row.grade_score !== null && row.grade_score !== undefined && row.test_date) {
        allScores.push({
          subject: row.subject_group,
          scoreType: "school",
          grade: row.grade_score,
          testDate: row.test_date,
        });
      }
    });

    mockRows.forEach((row) => {
      if (row.subject_group && row.grade_score !== null && row.grade_score !== undefined && row.test_date) {
        allScores.push({
          subject: row.subject_group,
          scoreType: "mock",
          grade: row.grade_score,
          testDate: row.test_date,
        });
      }
    });

    // 날짜순 정렬
    allScores.sort((a, b) => b.testDate.localeCompare(a.testDate));

    // 과목별로 그룹화하여 추이 분석
    const subjectMap = new Map<string, Array<{ grade: number; testDate: string }>>();
    allScores.forEach((score) => {
      const existing = subjectMap.get(score.subject) || [];
      existing.push({ grade: score.grade, testDate: score.testDate });
      subjectMap.set(score.subject, existing);
    });

    const decliningSubjects: string[] = [];
    const lowGradeSubjects: string[] = [];

    subjectMap.forEach((scores, subject) => {
      // 최근 2회 연속 하락 확인
      if (scores.length >= SCORE_CONSTANTS.DECLINING_TREND_THRESHOLD) {
        const sorted = scores.sort((a, b) => b.testDate.localeCompare(a.testDate));
        const recent2 = sorted.slice(0, SCORE_CONSTANTS.DECLINING_TREND_THRESHOLD);
        // 등급이 높아질수록 나쁨 (1등급이 최고, 9등급이 최악)
        if (recent2[0].grade > recent2[1].grade) {
          decliningSubjects.push(subject);
        }
      }

      // 저등급 과목 확인
      const latestGrade = scores.sort((a, b) => b.testDate.localeCompare(a.testDate))[0]?.grade;
      if (latestGrade !== undefined && latestGrade >= SCORE_CONSTANTS.LOW_GRADE_THRESHOLD) {
        lowGradeSubjects.push(subject);
      }
    });

    const hasDecliningTrend = decliningSubjects.length > 0;

    return {
      hasDecliningTrend,
      decliningSubjects,
      lowGradeSubjects,
      recentScores: allScores.slice(0, SCORE_TREND_CONSTANTS.RETURN_SCORES_LIMIT),
    };
  } catch (error) {
    console.error("[metrics/getScoreTrend] 성적 추이 조회 실패", error);
    return {
      hasDecliningTrend: false,
      decliningSubjects: [],
      lowGradeSubjects: [],
      recentScores: [],
    };
  }
}

