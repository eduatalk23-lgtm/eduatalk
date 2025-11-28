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
        ["사회", "과학"].includes(r.subject_group_name) && r.percentile != null
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
  const gradeCandidates = rows.filter(
    (r) =>
      ["국어", "수학", "영어", "사회", "과학"].includes(r.subject_group_name) &&
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
    console.error("[scores/mockAnalysis] 최근 시험 조회 실패", latestError);
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

  // 2. 해당 시험의 과목별 성적 조회
  // 같은 exam_date와 exam_title의 시험을 그룹화
  // student_mock_scores → subjects → subject_groups 순으로 조인
  // Supabase의 중첩 조인이 제대로 작동하지 않을 수 있으므로, 두 단계로 나누어 조회
  let query = supabase
    .from("student_mock_scores")
    .select("percentile, standard_score, grade_score, subject_id")
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
    console.error(
      "[scores/mockAnalysis] 모의고사 성적 조회 실패",
      mockScoresError
    );
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
    console.warn("[scores/mockAnalysis] 모의고사 성적 데이터가 없습니다");
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

  console.log(
    "[scores/mockAnalysis] 조회된 모의고사 성적:",
    JSON.stringify(mockScores, null, 2)
  );

  // subject_id 목록 추출
  const subjectIds = mockScores
    .map((score) => score.subject_id)
    .filter((id): id is string => id != null);

  console.log("[scores/mockAnalysis] 추출된 subject_ids:", subjectIds);

  if (subjectIds.length === 0) {
    console.warn("[scores/mockAnalysis] subject_id가 없습니다");
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

  // subjects 조회 (subject_group_id 포함)
  // 주의: subjects 테이블은 전역 관리이므로 tenant_id 컬럼이 없음
  // RLS 정책을 우회하기 위해 Admin 클라이언트 사용
  const adminClient = createSupabaseAdminClient();
  const subjectsClient = adminClient || supabase;

  const { data: subjectsData, error: subjectsError } = await subjectsClient
    .from("subjects")
    .select("id, subject_group_id")
    .in("id", subjectIds);

  console.log(
    "[scores/mockAnalysis] 조회된 subjects 데이터:",
    JSON.stringify(subjectsData, null, 2)
  );

  if (subjectsError) {
    console.error("[scores/mockAnalysis] 과목 정보 조회 실패", subjectsError);
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

  if (!subjectsData || subjectsData.length === 0) {
    console.warn("[scores/mockAnalysis] subjects 데이터가 없습니다");
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

  // subject_group_id 목록 추출
  const subjectGroupIds = subjectsData
    .map((subject) => subject.subject_group_id)
    .filter((id): id is string => id != null);

  if (subjectGroupIds.length === 0) {
    console.warn("[scores/mockAnalysis] subject_group_id가 없습니다");
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

  // subject_groups 조회
  // 주의: subject_groups 테이블은 전역 관리이므로 tenant_id 컬럼이 없음
  // RLS 정책을 우회하기 위해 Admin 클라이언트 사용
  const { data: subjectGroupsData, error: sgError } = await subjectsClient
    .from("subject_groups")
    .select("id, name")
    .in("id", subjectGroupIds);

  if (sgError) {
    console.error("[scores/mockAnalysis] 교과 그룹 정보 조회 실패", sgError);
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

  // subject_id → subject_group_id → subject_group_name 매핑 생성
  const subjectGroupMap = new Map(
    (subjectGroupsData || []).map((sg) => [sg.id, sg.name])
  );
  const subjectToGroupMap = new Map(
    subjectsData.map((s) => [s.id, s.subject_group_id])
  );

  const subjectMap = new Map<string, string>();
  for (const [subjectId, subjectGroupId] of subjectToGroupMap.entries()) {
    const subjectGroupName = subjectGroupId
      ? subjectGroupMap.get(subjectGroupId)
      : null;
    if (subjectGroupName) {
      subjectMap.set(subjectId, subjectGroupName);
    }
  }

  console.log(
    "[scores/mockAnalysis] 생성된 subjectMap:",
    Array.from(subjectMap.entries())
  );

  // 데이터 변환
  const rows: MockRow[] = mockScores
    .map((score) => {
      const subjectGroupName = subjectMap.get(score.subject_id) || "";
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

  console.log(
    "[scores/mockAnalysis] 변환된 rows:",
    JSON.stringify(rows, null, 2)
  );

  // 통계 계산
  const stats = calculateMockStats(rows);

  console.log(
    "[scores/mockAnalysis] 계산된 통계:",
    JSON.stringify(stats, null, 2)
  );

  return {
    recentExam: {
      examDate,
      examTitle,
    },
    ...stats,
  };
}
