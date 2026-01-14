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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractJoinResult } from "@/lib/supabase/queryHelpers";
import { logActionDebug, logActionWarn, logActionError } from "@/lib/utils/serverActionLogger";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

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
 * Supabase Relational Query 결과 타입
 * student_mock_scores 테이블과 subjects, subject_groups 조인 결과
 */
type MockScoreWithRelations = {
  percentile: number | null;
  standard_score: number | null;
  grade_score: number | null;
  subject_id: string | null;
  subject: {
    id: string;
    name: string;
    subject_group_id: string | null;
    subject_group: {
      id: string;
      name: string;
    } | null;
  } | null;
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
 * @param subjectGroupMap - 교과군 이름 → ID 매핑 (동적 처리용)
 * @returns 모의고사 통계 (recentExam 제외)
 */
function calculateMockStats(
  rows: MockRow[],
  subjectGroupMap: Map<string, string> = new Map()
): Omit<MockAnalysis, "recentExam"> {
  // subject_groups 테이블에서 특정 교과군 찾기
  // 기본적으로 "국어", "수학", "사회", "과학", "영어" 교과군을 찾지만,
  // subjectGroupMap을 통해 동적으로 매핑 가능
  const findSubjectGroup = (targetNames: string[]): string[] => {
    const foundNames: string[] = [];
    for (const [name, id] of subjectGroupMap.entries()) {
      if (targetNames.includes(name)) {
        foundNames.push(name);
      }
    }
    // subjectGroupMap에 없으면 기본 이름 사용 (하위 호환성)
    return foundNames.length > 0 ? foundNames : targetNames;
  };

  // 국어, 수학 교과군 찾기
  const koreanMathNames = findSubjectGroup(["국어", "수학"]);
  const koreanName = koreanMathNames.find((n) => n === "국어") || koreanMathNames[0];
  const mathName = koreanMathNames.find((n) => n === "수학") || koreanMathNames[1];

  const getOne = (name: string) =>
    rows.find((r) => r.subject_group_name === name && r.percentile != null);

  const korean = koreanName ? getOne(koreanName) : null;
  const math = mathName ? getOne(mathName) : null;

  // 탐구(사/과) 중 상위 2과목 백분위 평균
  // "사회", "과학" 교과군 찾기
  const inquiryNames = findSubjectGroup(["사회", "과학"]);
  const inquiryRows = rows
    .filter(
      (r) =>
        inquiryNames.includes(r.subject_group_name) && r.percentile != null
    )
    .sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))
    .slice(0, 2);

  const inquiryAvgPct =
    inquiryRows.length > 0
      ? inquiryRows.reduce((s, r) => s + (r.percentile ?? 0), 0) /
        inquiryRows.length
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
  // "국어", "수학", "영어", "사회", "과학" 교과군 찾기
  const gradeSubjectNames = findSubjectGroup(["국어", "수학", "영어", "사회", "과학"]);
  const gradeCandidates = rows.filter(
    (r) =>
      gradeSubjectNames.includes(r.subject_group_name) &&
      r.grade_score != null
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

  // 1. 가장 최근 시험 조회 (exam_date 기준)
  const { data: latestExam, error: latestError } = await supabase
    .from("student_mock_scores")
    .select("exam_date, exam_title")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .not("exam_date", "is", null)
    .order("exam_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    logActionError("mockAnalysis.getMockAnalysis", `최근 시험 조회 실패: ${latestError.message}`);
  }

  if (!latestExam || !latestExam.exam_date) {
    return {
      recentExam: null,
      avgPercentile: null,
      totalStdScore: null,
      best3GradeSum: null,
    };
  }

  const examDate = latestExam.exam_date;
  const examTitle = latestExam.exam_title || "";

  // 2. 해당 시험의 과목별 성적 조회 (Relational Query로 한 번에 조인)
  // student_mock_scores → subjects → subject_groups 순으로 중첩 조인
  let query = supabase
    .from("student_mock_scores")
    .select(`
      percentile,
      standard_score,
      grade_score,
      subject_id,
      subject:subjects (
        id,
        name,
        subject_group_id,
        subject_group:subject_groups (
          id,
          name
        )
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId)
    .eq("exam_date", examDate)
    .not("subject_id", "is", null);

  // exam_title도 일치하는 경우만 조회 (같은 날짜에 여러 시험이 있을 수 있음)
  if (examTitle) {
    query = query.eq("exam_title", examTitle);
  }

  const { data: mockScores, error: mockScoresError } = await query;

  if (mockScoresError) {
    logActionError("mockAnalysis.getMockAnalysis", `모의고사 성적 조회 실패: ${mockScoresError.message}`);
    return {
      recentExam: {
        examDate: examDate || "",
        examTitle,
      },
      avgPercentile: null,
      totalStdScore: null,
      best3GradeSum: null,
    };
  }

  if (!mockScores || mockScores.length === 0) {
    logActionWarn("mockAnalysis.getMockAnalysis", "모의고사 성적 데이터가 없습니다");
    return {
      recentExam: {
        examDate: examDate || "",
        examTitle,
      },
      avgPercentile: null,
      totalStdScore: null,
      best3GradeSum: null,
    };
  }

  // 데이터 변환 (조인 결과에서 직접 subject_group_name 추출)
  // 타입 안전성을 위해 Supabase의 타입 추론 활용
  type MockScoreQueryResult = {
    percentile: number | null;
    standard_score: number | null;
    grade_score: number | null;
    subject_id: string | null;
    subject: {
      id: string;
      name: string;
      subject_group_id: string | null;
      subject_group: {
        id: string;
        name: string;
      } | null;
    } | null;
  };

  const rows: MockRow[] = (mockScores as unknown as MockScoreQueryResult[])
    .map((score) => {
      // Relational Query 결과에서 subject_group_name 추출
      // subject가 배열로 반환될 수 있으므로 첫 번째 요소 사용
      const subject = extractJoinResult(score.subject);
      const subjectGroupName =
        subject?.subject_group?.name || "";
      
      return {
        subject_group_name: subjectGroupName,
        percentile: score.percentile != null ? Number(score.percentile) : null,
        standard_score:
          score.standard_score != null ? Number(score.standard_score) : null,
        grade_score:
          score.grade_score != null ? Number(score.grade_score) : null,
      };
    })
    .filter((row) => row.subject_group_name !== ""); // subject_group_name이 없는 경우 제외

  logActionDebug("mockAnalysis.getMockAnalysis", `변환된 rows: ${JSON.stringify(rows)}`);

  // subject_groups 테이블에서 교과군 목록 조회 (동적 처리)
  const adminClient = createSupabaseAdminClient();
  const groupsClient = adminClient || supabase;
  const { data: subjectGroupsData } = await groupsClient
    .from("subject_groups")
    .select("id, name")
    .order("name", { ascending: true });

  // 교과군 이름 → ID 매핑 생성
  const subjectGroupMap = new Map<string, string>();
  if (subjectGroupsData) {
    for (const group of subjectGroupsData) {
      subjectGroupMap.set(group.name, group.id);
    }
  }

  // 통계 계산 (동적 교과군 매핑 전달)
  const stats = calculateMockStats(rows, subjectGroupMap);

  logActionDebug("mockAnalysis.getMockAnalysis", `계산된 통계: ${JSON.stringify(stats)}`);

  return {
    recentExam: {
      examDate,
      examTitle,
    },
    ...stats,
  };
}
