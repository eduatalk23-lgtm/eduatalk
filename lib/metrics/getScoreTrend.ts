import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

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
    // 내신 성적 조회
    const selectSchoolScores = () =>
      supabase
        .from("student_school_scores")
        .select("subject_group,grade_score,test_date")
        .order("test_date", { ascending: false })
        .limit(20);

    let { data: schoolScores, error: schoolError } = await selectSchoolScores().eq(
      "student_id",
      studentId
    );

    if (schoolError && schoolError.code === "42703") {
      ({ data: schoolScores, error: schoolError } = await selectSchoolScores());
    }

    // 모의고사 성적 조회
    const selectMockScores = () =>
      supabase
        .from("student_mock_scores")
        .select("subject_group,grade_score,test_date")
        .order("test_date", { ascending: false })
        .limit(20);

    let { data: mockScores, error: mockError } = await selectMockScores().eq(
      "student_id",
      studentId
    );

    if (mockError && mockError.code === "42703") {
      ({ data: mockScores, error: mockError } = await selectMockScores());
    }

    const schoolRows = (schoolScores as Array<{
      subject_group?: string | null;
      grade_score?: number | null;
      test_date?: string | null;
    }> | null) ?? [];

    const mockRows = (mockScores as Array<{
      subject_group?: string | null;
      grade_score?: number | null;
      test_date?: string | null;
    }> | null) ?? [];

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
      if (scores.length >= 2) {
        const sorted = scores.sort((a, b) => b.testDate.localeCompare(a.testDate));
        const recent2 = sorted.slice(0, 2);
        // 등급이 높아질수록 나쁨 (1등급이 최고, 9등급이 최악)
        if (recent2[0].grade > recent2[1].grade) {
          decliningSubjects.push(subject);
        }
      }

      // 7등급 이하 과목 확인
      const latestGrade = scores.sort((a, b) => b.testDate.localeCompare(a.testDate))[0]?.grade;
      if (latestGrade !== undefined && latestGrade >= 7) {
        lowGradeSubjects.push(subject);
      }
    });

    const hasDecliningTrend = decliningSubjects.length > 0;

    return {
      hasDecliningTrend,
      decliningSubjects,
      lowGradeSubjects,
      recentScores: allScores.slice(0, 10), // 최근 10개만 반환
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

