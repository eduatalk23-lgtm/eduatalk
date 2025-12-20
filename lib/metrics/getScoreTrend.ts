import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeQueryArray } from "@/lib/supabase/safeQuery";
import { SCORE_CONSTANTS, SCORE_TREND_CONSTANTS } from "@/lib/metrics/constants";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 내신 성적 조회 결과 타입
 * 
 * student_internal_scores 테이블에서 조회
 * - rank_grade: 석차등급 (1~9, null 가능)
 * - created_at: 생성일 (내신은 시험일자가 없으므로 생성일 기준 정렬)
 */
type InternalScoreRow = {
  rank_grade: number | null;
  grade: number | null;
  semester: number | null;
  created_at: string;
  subject_groups: {
    name: string;
  } | null;
};

/**
 * 모의고사 성적 조회 결과 타입
 * 
 * student_mock_scores 테이블에서 조회
 * - grade_score: 등급 (1~9, null 가능)
 * - exam_date: 시험일자
 */
type MockScoreRow = {
  grade_score: number | null;
  exam_date: string;
  subject_groups: {
    name: string;
  } | null;
};

export type ScoreTrendMetrics = {
  hasDecliningTrend: boolean; // 최근 2회 연속 등급 하락
  decliningSubjects: string[]; // 하락한 과목 목록
  lowGradeSubjects: string[]; // 7등급 이하 과목 목록
  recentScores: Array<{
    subject: string;
    scoreType: "internal" | "mock";
    grade: number;
    testDate: string;
  }>;
};

/**
 * 성적 추이 메트릭 조회
 * 
 * 내신 성적(student_internal_scores)과 모의고사 성적(student_mock_scores)을 조회하여
 * 최근 성적 추이를 분석합니다.
 * 
 * @param supabase - Supabase 서버 클라이언트
 * @param studentId - 학생 ID
 * @returns 성적 추이 메트릭
 */
export async function getScoreTrend(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<ScoreTrendMetrics> {
  try {
    // 내신 성적 및 모의고사 성적 병렬 조회
    const [internalRows, mockRows] = await Promise.all([
      // 내신 성적 조회: student_internal_scores 테이블 사용
      safeQueryArray<InternalScoreRow>(
        () =>
          supabase
            .from("student_internal_scores")
            .select("rank_grade,grade,semester,created_at,subject_groups:subject_group_id(name)")
            .eq("student_id", studentId)
            .order("created_at", { ascending: false })
            .limit(SCORE_TREND_CONSTANTS.RECENT_SCORES_LIMIT),
        // 42703 에러 발생 시 fallback 쿼리 (student_id 필터 제거)
        () =>
          supabase
            .from("student_internal_scores")
            .select("rank_grade,grade,semester,created_at,subject_groups:subject_group_id(name)")
            .order("created_at", { ascending: false })
            .limit(SCORE_TREND_CONSTANTS.RECENT_SCORES_LIMIT),
        { context: "[metrics/getScoreTrend] 내신 성적 조회" }
      ),
      // 모의고사 성적 조회: student_mock_scores 테이블 사용
      safeQueryArray<MockScoreRow>(
        () =>
          supabase
            .from("student_mock_scores")
            .select("grade_score,exam_date,subject_groups:subject_group_id(name)")
            .eq("student_id", studentId)
            .order("exam_date", { ascending: false })
            .limit(SCORE_TREND_CONSTANTS.RECENT_SCORES_LIMIT),
        // 42703 에러 발생 시 fallback 쿼리 (student_id 필터 제거)
        () =>
          supabase
            .from("student_mock_scores")
            .select("grade_score,exam_date,subject_groups:subject_group_id(name)")
            .order("exam_date", { ascending: false })
            .limit(SCORE_TREND_CONSTANTS.RECENT_SCORES_LIMIT),
        { context: "[metrics/getScoreTrend] 모의고사 성적 조회" }
      ),
    ]);

    // 모든 성적을 하나의 배열로 합치기
    const allScores: Array<{
      subject: string;
      scoreType: "internal" | "mock";
      grade: number;
      testDate: string;
    }> = [];

    // 내신 성적 처리
    // - rank_grade를 등급으로 사용
    // - created_at을 testDate로 사용 (내신은 시험일자가 없으므로 생성일 기준)
    internalRows.forEach((row) => {
      const subjectName = row.subject_groups?.name;
      const grade = row.rank_grade;
      
      // subject_groups.name이 null이거나 grade가 null인 경우 제외
      if (subjectName && grade !== null && grade !== undefined && row.created_at) {
        allScores.push({
          subject: subjectName,
          scoreType: "internal",
          grade: grade,
          testDate: row.created_at,
        });
      }
    });

    // 모의고사 성적 처리
    // - grade_score를 등급으로 사용
    // - exam_date를 testDate로 사용
    mockRows.forEach((row) => {
      const subjectName = row.subject_groups?.name;
      const grade = row.grade_score;
      
      // subject_groups.name이 null이거나 grade가 null인 경우 제외
      if (subjectName && grade !== null && grade !== undefined && row.exam_date) {
        allScores.push({
          subject: subjectName,
          scoreType: "mock",
          grade: grade,
          testDate: row.exam_date,
        });
      }
    });

    // 날짜순 정렬 (최신순)
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
        // recent2[0]이 최신, recent2[1]이 그 이전
        if (recent2[0].grade > recent2[1].grade) {
          decliningSubjects.push(subject);
        }
      }

      // 저등급 과목 확인 (7등급 이상)
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
    // 예외 발생 시 상세 정보 로깅
    const errorInfo: Record<string, unknown> = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    };
    
    try {
      errorInfo.raw = JSON.parse(JSON.stringify(error));
    } catch {
      errorInfo.raw = String(error);
    }
    
    console.error("[metrics/getScoreTrend] 성적 추이 조회 실패", errorInfo);
    return {
      hasDecliningTrend: false,
      decliningSubjects: [],
      lowGradeSubjects: [],
      recentScores: [],
    };
  }
}

