/**
 * 모의고사 분석 서비스
 * 
 * student_mock_scores 테이블을 기반으로 모의고사 분석을 수행합니다.
 * - 최근 시험 정보 조회
 * - 국/수/탐(상위2) 평균 백분위 계산
 * - 국/수/탐(상위2) 표준점수 합 계산
 * - 국·수·영·탐 중 상위 3개 등급 합 계산
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 모의고사 과목 데이터 타입
 */
type MockRow = {
  subject_group_name: string;
  percentile: number | null;
  standard_score: number | null;
  grade_score: number | null;
};

/**
 * 모의고사 분석 결과 타입
 */
export type MockAnalysis = {
  recentExam: { examDate: string; examTitle: string } | null;
  avgPercentile: number | null; // 국/수/탐(상위2) 평균 백분위
  totalStdScore: number | null; // 국/수/탐(상위2) 표준점수 합
  best3GradeSum: number | null; // 국·수·영·탐 중 상위 3개 등급 합
};

/**
 * 모의고사 통계 계산
 * 
 * @param rows - 모의고사 과목 데이터 배열
 * @returns 모의고사 통계 (recentExam 제외)
 */
function calculateMockStats(rows: MockRow[]): Omit<MockAnalysis, "recentExam"> {
  // 국어, 수학 조회
  const getOne = (name: string) =>
    rows.find((r) => r.subject_group_name === name && r.percentile != null);

  const korean = getOne("국어");
  const math = getOne("수학");

  // 탐구(사/과) 중 상위 2과목 백분위 평균
  const inquiryRows = rows
    .filter(
      (r) =>
        ["사회(역사/도덕 포함)", "과학"].includes(r.subject_group_name) &&
        r.percentile != null
    )
    .sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))
    .slice(0, 2);

  const inquiryAvgPct =
    inquiryRows.length > 0
      ? inquiryRows.reduce((s, r) => s + (r.percentile ?? 0), 0) / inquiryRows.length
      : null;

  // 국/수/탐(상위2) 평균 백분위
  const avgPercentile =
    korean?.percentile != null &&
    math?.percentile != null &&
    inquiryAvgPct != null
      ? (korean.percentile + math.percentile + inquiryAvgPct) / 3
      : null;

  // 국/수/탐(상위2) 표준점수 합
  const totalStdScore =
    (korean?.standard_score ?? 0) +
    (math?.standard_score ?? 0) +
    inquiryRows.reduce((s, r) => s + (r.standard_score ?? 0), 0);

  // 국·수·영·탐 중 상위 3개 등급 합
  const gradeCandidates = rows.filter(
    (r) =>
      ["국어", "수학", "영어", "사회(역사/도덕 포함)", "과학"].includes(
        r.subject_group_name
      ) && r.grade_score != null
  );

  const best3GradeSum =
    gradeCandidates.length > 0
      ? gradeCandidates
          .sort((a, b) => (a.grade_score ?? 9) - (b.grade_score ?? 9)) // 낮을수록 좋은 등급
          .slice(0, 3)
          .reduce((s, r) => s + (r.grade_score ?? 0), 0)
      : null;

  return {
    avgPercentile,
    totalStdScore: totalStdScore > 0 ? totalStdScore : null,
    best3GradeSum,
  };
}

/**
 * 모의고사 분석 수행
 * 
 * @param tenantId - 테넌트 ID
 * @param studentId - 학생 ID
 * @returns 모의고사 분석 결과
 */
export async function getMockAnalysis(
  tenantId: string,
  studentId: string
): Promise<MockAnalysis> {
  const supabase = await createSupabaseServerClient();

  // 1. 가장 최근 시험 조회
  const { data: latestExam, error: latestError } = await supabase
    .from("student_mock_scores")
    .select("exam_date, exam_title")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .order("exam_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    console.error("[scores/mockAnalysis] 최근 시험 조회 실패", latestError);
  }

  if (!latestExam || !latestExam.exam_date || !latestExam.exam_title) {
    return {
      recentExam: null,
      avgPercentile: null,
      totalStdScore: null,
      best3GradeSum: null,
    };
  }

  const examDate = String(latestExam.exam_date);
  const examTitle = String(latestExam.exam_title);

  // 2. 해당 시험의 과목별 성적 조회
  const { data: subjectData, error: subjectError } = await supabase
    .from("student_mock_scores")
    .select(
      `
      percentile,
      standard_score,
      grade_score,
      subject_groups!inner(name)
      `
    )
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("exam_date", examDate)
    .eq("exam_title", examTitle);

  if (subjectError) {
    console.error("[scores/mockAnalysis] 과목별 성적 조회 실패", subjectError);
    return {
      recentExam: {
        examDate,
        examTitle,
      },
      avgPercentile: null,
      totalStdScore: null,
      best3GradeSum: null,
    };
  }

  // 데이터 변환
  const rows: MockRow[] = (subjectData || []).map((row: any) => ({
    subject_group_name: row.subject_groups?.name || "",
    percentile: row.percentile != null ? Number(row.percentile) : null,
    standard_score: row.standard_score != null ? Number(row.standard_score) : null,
    grade_score: row.grade_score != null ? Number(row.grade_score) : null,
  }));

  // 통계 계산
  const stats = calculateMockStats(rows);

  return {
    recentExam: {
      examDate,
      examTitle,
    },
    ...stats,
  };
}

