/**
 * 성적 대시보드 API 테스트용 더미 데이터 생성 스크립트
 * 
 * 실행 방법:
 * npx tsx scripts/seedScoreDashboardDummy.ts
 * 
 * 생성되는 데이터:
 * - 학생 A: 정시 우위 (MOCK_ADVANTAGE) - 내신 중간, 모의고사 높음
 * - 학생 B: 수시 우위 (INTERNAL_ADVANTAGE) - 내신 상위, 모의고사 낮음
 * - 학생 C: BALANCED - 내신과 모의고사 비슷
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import path from "path";

// .env.local 파일 로드
config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ 환경 변수가 설정되지 않았습니다.");
  console.error("   NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  console.error("   .env.local 파일에 SUPABASE_SERVICE_ROLE_KEY를 추가하세요.");
  console.error("   Supabase Dashboard → Settings → API → service_role key");
  process.exit(1);
}

// RLS를 우회하기 위해 Service Role Key 사용
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const DUMMY_TAG = "DUMMY_SCORE_TEST";

/**
 * 더미 데이터 생성 결과 타입
 */
type DummyDataResult = {
  studentId: string;
  tenantId: string;
  studentTermId: string;
  name: string;
  type: "MOCK_ADVANTAGE" | "INTERNAL_ADVANTAGE" | "BALANCED";
};

/**
 * 테넌트 조회 또는 생성
 */
async function getOrCreateTenant(): Promise<string> {
  // 1. 기존 테넌트 조회
  const { data: tenants, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name")
    .limit(1);

  if (!tenantError && tenants && tenants.length > 0) {
    console.log(`✅ 기존 테넌트 사용: ${tenants[0].name} (${tenants[0].id})`);
    return tenants[0].id;
  }

  // 2. 테넌트가 없으면 생성
  console.log("⚠️  테넌트가 없습니다. 더미 테넌트를 생성합니다...");
  const { data: newTenant, error: createError } = await supabase
    .from("tenants")
    .insert({
      name: "더미 테스트 테넌트",
      type: "academy",
    })
    .select("id, name")
    .single();

  if (createError || !newTenant) {
    throw new Error(
      `테넌트 생성 실패: ${createError?.message || "알 수 없는 오류"}`
    );
  }

  console.log(`✅ 테넌트 생성 완료: ${newTenant.name} (${newTenant.id})`);
  return newTenant.id;
}

/**
 * 필요한 메타데이터 조회
 */
async function fetchMetadata() {
  console.log("📋 메타데이터 조회 중...\n");

  // 1. 테넌트 조회 또는 생성
  const tenantId = await getOrCreateTenant();

  // 2. 교육과정 개정 조회 (2022개정 우선, 없으면 2015개정)
  const { data: revisions, error: revisionError } = await supabase
    .from("curriculum_revisions")
    .select("id, name")
    .order("year", { ascending: false })
    .limit(1);

  if (revisionError || !revisions || revisions.length === 0) {
    throw new Error("교육과정 개정을 찾을 수 없습니다.");
  }

  const curriculumRevisionId = revisions[0].id;
  console.log(`✅ 교육과정 개정: ${revisions[0].name} (${curriculumRevisionId})`);

  // 3. 교과 그룹 조회 (국어, 수학, 영어, 사회, 과학)
  const { data: subjectGroups, error: sgError } = await supabase
    .from("subject_groups")
    .select("id, name")
    .eq("curriculum_revision_id", curriculumRevisionId)
    .in("name", ["국어", "수학", "영어", "사회", "과학"]);

  if (sgError || !subjectGroups || subjectGroups.length < 5) {
    throw new Error("필요한 교과 그룹을 찾을 수 없습니다.");
  }

  const subjectGroupMap: Record<string, string> = {};
  for (const sg of subjectGroups) {
    subjectGroupMap[sg.name] = sg.id;
  }

  console.log(`✅ 교과 그룹 조회 완료: ${subjectGroups.length}개`);

  // 4. 과목 구분 조회 또는 생성 (공통 우선)
  let commonSubjectTypeId: string;

  const { data: subjectTypes, error: stError } = await supabase
    .from("subject_types")
    .select("id, name")
    .eq("curriculum_revision_id", curriculumRevisionId)
    .in("name", ["공통", "일반선택"])
    .order("display_order", { ascending: true });

  if (stError || !subjectTypes || subjectTypes.length === 0) {
    // 과목 구분이 없으면 생성
    console.log("⚠️  과목 구분이 없습니다. 기본 과목 구분을 생성합니다...");

    // 공통 생성
    const { data: commonType, error: commonError } = await supabase
      .from("subject_types")
      .insert({
        curriculum_revision_id: curriculumRevisionId,
        name: "공통",
        is_active: true,
      })
      .select("id")
      .single();

    if (commonError || !commonType) {
      throw new Error(
        `과목 구분 생성 실패: ${commonError?.message || "알 수 없는 오류"}`
      );
    }

    commonSubjectTypeId = commonType.id;
    console.log(`✅ 과목 구분 생성 완료: 공통 (${commonSubjectTypeId})`);
  } else {
    commonSubjectTypeId =
      subjectTypes.find((st) => st.name === "공통")?.id ||
      subjectTypes[0].id;
    console.log(`✅ 과목 구분 조회 완료: ${subjectTypes.length}개`);
  }

  // 5. 과목 조회 (각 교과 그룹의 첫 번째 과목 사용)
  const subjectIds: string[] = [];
  for (const sgName of ["국어", "수학", "영어", "사회", "과학"]) {
    const sgId = subjectGroupMap[sgName];
    if (!sgId) continue;

    const { data: subjects, error: subError } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("subject_group_id", sgId)
      .limit(1);

    if (!subError && subjects && subjects.length > 0) {
      subjectIds.push(subjects[0].id);
      console.log(`  - ${sgName}: ${subjects[0].name} (${subjects[0].id})`);
    }
  }

  if (subjectIds.length < 5) {
    throw new Error("필요한 과목을 찾을 수 없습니다.");
  }

  return {
    tenantId,
    curriculumRevisionId,
    subjectGroupMap,
    commonSubjectTypeId,
    subjectIds: {
      korean: subjectIds[0],
      math: subjectIds[1],
      english: subjectIds[2],
      social: subjectIds[3],
      science: subjectIds[4],
    },
  };
}

/**
 * 학생 생성
 */
async function createStudent(
  tenantId: string,
  name: string,
  grade: number
): Promise<string> {
  // user_id는 임시로 생성 (실제로는 auth.users에 있어야 함)
  // 더미 데이터이므로 임시 UUID 사용
  const userId = randomUUID();

  const { data, error } = await supabase
    .from("students")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      name,
      grade,
      school_type: "HIGH",
      memo: DUMMY_TAG,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`학생 생성 실패: ${error.message}`);
  }

  return data.id;
}

/**
 * 학생 학기 생성
 */
async function createStudentTerm(
  tenantId: string,
  studentId: string,
  curriculumRevisionId: string,
  schoolYear: number,
  grade: number,
  semester: number
): Promise<string> {
  const { data, error } = await supabase
    .from("student_terms")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      school_year: schoolYear,
      grade,
      semester,
      curriculum_revision_id: curriculumRevisionId,
      notes: DUMMY_TAG,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`학생 학기 생성 실패: ${error.message}`);
  }

  return data.id;
}

/**
 * 내신 성적 생성
 */
async function createInternalScore(
  tenantId: string,
  studentId: string,
  studentTermId: string,
  curriculumRevisionId: string,
  subjectGroupId: string,
  subjectTypeId: string,
  subjectId: string,
  grade: number,
  semester: number,
  rankGrade: number,
  creditHours: number,
  rawScore: number,
  avgScore: number,
  stdDev: number
) {
  const { error } = await supabase.from("student_internal_scores").insert({
    tenant_id: tenantId,
    student_id: studentId,
    student_term_id: studentTermId,
    curriculum_revision_id: curriculumRevisionId,
    subject_group_id: subjectGroupId,
    subject_type_id: subjectTypeId,
    subject_id: subjectId,
    grade,
    semester,
    rank_grade: rankGrade,
    credit_hours: creditHours,
    raw_score: rawScore,
    avg_score: avgScore,
    std_dev: stdDev,
    total_students: 100,
    notes: DUMMY_TAG,
  });

  if (error) {
    throw new Error(`내신 성적 생성 실패: ${error.message}`);
  }
}

/**
 * 모의고사 성적 생성
 */
async function createMockScore(
  tenantId: string,
  studentId: string,
  studentTermId: string,
  subjectGroupId: string,
  subjectId: string,
  grade: number,
  examDate: string,
  examTitle: string,
  percentile: number,
  standardScore: number,
  gradeScore: number
) {
  const { error } = await supabase.from("student_mock_scores").insert({
    tenant_id: tenantId,
    student_id: studentId,
    student_term_id: studentTermId,
    subject_group_id: subjectGroupId,
    subject_id: subjectId,
    grade,
    exam_date: examDate,
    exam_title: examTitle,
    percentile,
    standard_score: standardScore,
    grade_score: gradeScore,
    notes: DUMMY_TAG,
  });

  if (error) {
    throw new Error(`모의고사 성적 생성 실패: ${error.message}`);
  }
}

/**
 * 학생 A 생성 (정시 우위 - MOCK_ADVANTAGE)
 * - 내신: GPA 3.0 근처 (중간)
 * - 모의고사: 평백 85 (내신 환산 백분위 70보다 +15 높음)
 */
async function createStudentA(
  metadata: Awaited<ReturnType<typeof fetchMetadata>>
): Promise<DummyDataResult> {
  console.log("\n📝 학생 A 생성 중 (정시 우위 - MOCK_ADVANTAGE)...");

  const studentId = await createStudent(
    metadata.tenantId,
    "더미학생A_정시우위",
    2
  );

  const studentTermId = await createStudentTerm(
    metadata.tenantId,
    studentId,
    metadata.curriculumRevisionId,
    2025,
    2,
    1
  );

  // 내신 성적 생성 (GPA 3.0 근처)
  // rank_grade: 3등급 (GPA 3.0)
  const internalScores = [
    {
      subjectGroup: "국어",
      rankGrade: 3,
      creditHours: 5,
      rawScore: 75,
      avgScore: 70,
      stdDev: 10,
    },
    {
      subjectGroup: "수학",
      rankGrade: 3,
      creditHours: 5,
      rawScore: 73,
      avgScore: 68,
      stdDev: 12,
    },
    {
      subjectGroup: "영어",
      rankGrade: 3,
      creditHours: 5,
      rawScore: 77,
      avgScore: 72,
      stdDev: 11,
    },
    {
      subjectGroup: "사회",
      rankGrade: 4,
      creditHours: 4,
      rawScore: 68,
      avgScore: 65,
      stdDev: 9,
    },
    {
      subjectGroup: "과학",
      rankGrade: 3,
      creditHours: 4,
      rawScore: 76,
      avgScore: 71,
      stdDev: 10,
    },
  ];

  for (const score of internalScores) {
    const sgId = metadata.subjectGroupMap[score.subjectGroup];
    const subjectId =
      score.subjectGroup === "국어"
        ? metadata.subjectIds.korean
        : score.subjectGroup === "수학"
        ? metadata.subjectIds.math
        : score.subjectGroup === "영어"
        ? metadata.subjectIds.english
        : score.subjectGroup === "사회"
        ? metadata.subjectIds.social
        : metadata.subjectIds.science;

    await createInternalScore(
      metadata.tenantId,
      studentId,
      studentTermId,
      metadata.curriculumRevisionId,
      sgId,
      metadata.commonSubjectTypeId,
      subjectId,
      2,
      1,
      score.rankGrade,
      score.creditHours,
      score.rawScore,
      score.avgScore,
      score.stdDev
    );
  }

  // 모의고사 성적 생성 (평백 85 - 내신 환산 백분위 70보다 +15 높음)
  const examDate = "2025-06-01";
  const examTitle = "2025-06 모평";

  const mockScores = [
    {
      subjectGroup: "국어",
      percentile: 85,
      standardScore: 135,
      gradeScore: 2,
    },
    {
      subjectGroup: "수학",
      percentile: 84,
      standardScore: 133,
      gradeScore: 2,
    },
    {
      subjectGroup: "영어",
      percentile: 86,
      standardScore: 137,
      gradeScore: 2,
    },
    {
      subjectGroup: "사회",
      percentile: 83,
      standardScore: 132,
      gradeScore: 3,
    },
    {
      subjectGroup: "과학",
      percentile: 87,
      standardScore: 138,
      gradeScore: 2,
    },
  ];

  for (const score of mockScores) {
    const sgId = metadata.subjectGroupMap[score.subjectGroup];
    const subjectId =
      score.subjectGroup === "국어"
        ? metadata.subjectIds.korean
        : score.subjectGroup === "수학"
        ? metadata.subjectIds.math
        : score.subjectGroup === "영어"
        ? metadata.subjectIds.english
        : score.subjectGroup === "사회"
        ? metadata.subjectIds.social
        : metadata.subjectIds.science;

    await createMockScore(
      metadata.tenantId,
      studentId,
      studentTermId,
      sgId,
      subjectId,
      2,
      examDate,
      examTitle,
      score.percentile,
      score.standardScore,
      score.gradeScore
    );
  }

  console.log(`✅ 학생 A 생성 완료: ${studentId}`);

  return {
    studentId,
    tenantId: metadata.tenantId,
    studentTermId,
    name: "더미학생A_정시우위",
    type: "MOCK_ADVANTAGE",
  };
}

/**
 * 학생 B 생성 (수시 우위 - INTERNAL_ADVANTAGE)
 * - 내신: GPA 1.8 근처 (상위권)
 * - 모의고사: 평백 65 (내신 환산 백분위 85보다 -20 낮음)
 */
async function createStudentB(
  metadata: Awaited<ReturnType<typeof fetchMetadata>>
): Promise<DummyDataResult> {
  console.log("\n📝 학생 B 생성 중 (수시 우위 - INTERNAL_ADVANTAGE)...");

  const studentId = await createStudent(
    metadata.tenantId,
    "더미학생B_수시우위",
    2
  );

  const studentTermId = await createStudentTerm(
    metadata.tenantId,
    studentId,
    metadata.curriculumRevisionId,
    2025,
    2,
    1
  );

  // 내신 성적 생성 (GPA 1.8 근처)
  // rank_grade: 2등급 (GPA 2.0)
  const internalScores = [
    {
      subjectGroup: "국어",
      rankGrade: 2,
      creditHours: 5,
      rawScore: 92,
      avgScore: 85,
      stdDev: 8,
    },
    {
      subjectGroup: "수학",
      rankGrade: 2,
      creditHours: 5,
      rawScore: 90,
      avgScore: 83,
      stdDev: 9,
    },
    {
      subjectGroup: "영어",
      rankGrade: 1,
      creditHours: 5,
      rawScore: 95,
      avgScore: 88,
      stdDev: 7,
    },
    {
      subjectGroup: "사회",
      rankGrade: 2,
      creditHours: 4,
      rawScore: 91,
      avgScore: 84,
      stdDev: 8,
    },
    {
      subjectGroup: "과학",
      rankGrade: 2,
      creditHours: 4,
      rawScore: 93,
      avgScore: 86,
      stdDev: 7,
    },
  ];

  for (const score of internalScores) {
    const sgId = metadata.subjectGroupMap[score.subjectGroup];
    const subjectId =
      score.subjectGroup === "국어"
        ? metadata.subjectIds.korean
        : score.subjectGroup === "수학"
        ? metadata.subjectIds.math
        : score.subjectGroup === "영어"
        ? metadata.subjectIds.english
        : score.subjectGroup === "사회"
        ? metadata.subjectIds.social
        : metadata.subjectIds.science;

    await createInternalScore(
      metadata.tenantId,
      studentId,
      studentTermId,
      metadata.curriculumRevisionId,
      sgId,
      metadata.commonSubjectTypeId,
      subjectId,
      2,
      1,
      score.rankGrade,
      score.creditHours,
      score.rawScore,
      score.avgScore,
      score.stdDev
    );
  }

  // 모의고사 성적 생성 (평백 65 - 내신 환산 백분위 85보다 -20 낮음)
  const examDate = "2025-06-01";
  const examTitle = "2025-06 모평";

  const mockScores = [
    {
      subjectGroup: "국어",
      percentile: 65,
      standardScore: 115,
      gradeScore: 4,
    },
    {
      subjectGroup: "수학",
      percentile: 64,
      standardScore: 114,
      gradeScore: 4,
    },
    {
      subjectGroup: "영어",
      percentile: 66,
      standardScore: 116,
      gradeScore: 4,
    },
    {
      subjectGroup: "사회",
      percentile: 63,
      standardScore: 113,
      gradeScore: 5,
    },
    {
      subjectGroup: "과학",
      percentile: 67,
      standardScore: 117,
      gradeScore: 4,
    },
  ];

  for (const score of mockScores) {
    const sgId = metadata.subjectGroupMap[score.subjectGroup];
    const subjectId =
      score.subjectGroup === "국어"
        ? metadata.subjectIds.korean
        : score.subjectGroup === "수학"
        ? metadata.subjectIds.math
        : score.subjectGroup === "영어"
        ? metadata.subjectIds.english
        : score.subjectGroup === "사회"
        ? metadata.subjectIds.social
        : metadata.subjectIds.science;

    await createMockScore(
      metadata.tenantId,
      studentId,
      studentTermId,
      sgId,
      subjectId,
      2,
      examDate,
      examTitle,
      score.percentile,
      score.standardScore,
      score.gradeScore
    );
  }

  console.log(`✅ 학생 B 생성 완료: ${studentId}`);

  return {
    studentId,
    tenantId: metadata.tenantId,
    studentTermId,
    name: "더미학생B_수시우위",
    type: "INTERNAL_ADVANTAGE",
  };
}

/**
 * 학생 C 생성 (BALANCED)
 * - 내신: GPA 2.5 근처
 * - 모의고사: 평백 78 (내신 환산 백분위 80과 비슷, 차이 -2)
 */
async function createStudentC(
  metadata: Awaited<ReturnType<typeof fetchMetadata>>
): Promise<DummyDataResult> {
  console.log("\n📝 학생 C 생성 중 (BALANCED)...");

  const studentId = await createStudent(
    metadata.tenantId,
    "더미학생C_균형형",
    2
  );

  const studentTermId = await createStudentTerm(
    metadata.tenantId,
    studentId,
    metadata.curriculumRevisionId,
    2025,
    2,
    1
  );

  // 내신 성적 생성 (GPA 2.5 근처)
  const internalScores = [
    {
      subjectGroup: "국어",
      rankGrade: 2,
      creditHours: 5,
      rawScore: 82,
      avgScore: 78,
      stdDev: 9,
    },
    {
      subjectGroup: "수학",
      rankGrade: 3,
      creditHours: 5,
      rawScore: 78,
      avgScore: 75,
      stdDev: 10,
    },
    {
      subjectGroup: "영어",
      rankGrade: 2,
      creditHours: 5,
      rawScore: 85,
      avgScore: 80,
      stdDev: 8,
    },
    {
      subjectGroup: "사회",
      rankGrade: 3,
      creditHours: 4,
      rawScore: 76,
      avgScore: 73,
      stdDev: 9,
    },
    {
      subjectGroup: "과학",
      rankGrade: 2,
      creditHours: 4,
      rawScore: 83,
      avgScore: 79,
      stdDev: 8,
    },
  ];

  for (const score of internalScores) {
    const sgId = metadata.subjectGroupMap[score.subjectGroup];
    const subjectId =
      score.subjectGroup === "국어"
        ? metadata.subjectIds.korean
        : score.subjectGroup === "수학"
        ? metadata.subjectIds.math
        : score.subjectGroup === "영어"
        ? metadata.subjectIds.english
        : score.subjectGroup === "사회"
        ? metadata.subjectIds.social
        : metadata.subjectIds.science;

    await createInternalScore(
      metadata.tenantId,
      studentId,
      studentTermId,
      metadata.curriculumRevisionId,
      sgId,
      metadata.commonSubjectTypeId,
      subjectId,
      2,
      1,
      score.rankGrade,
      score.creditHours,
      score.rawScore,
      score.avgScore,
      score.stdDev
    );
  }

  // 모의고사 성적 생성 (평백 78 - 내신 환산 백분위 80과 비슷)
  const examDate = "2025-06-01";
  const examTitle = "2025-06 모평";

  const mockScores = [
    {
      subjectGroup: "국어",
      percentile: 78,
      standardScore: 125,
      gradeScore: 3,
    },
    {
      subjectGroup: "수학",
      percentile: 77,
      standardScore: 124,
      gradeScore: 3,
    },
    {
      subjectGroup: "영어",
      percentile: 79,
      standardScore: 126,
      gradeScore: 3,
    },
    {
      subjectGroup: "사회",
      percentile: 76,
      standardScore: 123,
      gradeScore: 3,
    },
    {
      subjectGroup: "과학",
      percentile: 80,
      standardScore: 127,
      gradeScore: 2,
    },
  ];

  for (const score of mockScores) {
    const sgId = metadata.subjectGroupMap[score.subjectGroup];
    const subjectId =
      score.subjectGroup === "국어"
        ? metadata.subjectIds.korean
        : score.subjectGroup === "수학"
        ? metadata.subjectIds.math
        : score.subjectGroup === "영어"
        ? metadata.subjectIds.english
        : score.subjectGroup === "사회"
        ? metadata.subjectIds.social
        : metadata.subjectIds.science;

    await createMockScore(
      metadata.tenantId,
      studentId,
      studentTermId,
      sgId,
      subjectId,
      2,
      examDate,
      examTitle,
      score.percentile,
      score.standardScore,
      score.gradeScore
    );
  }

  console.log(`✅ 학생 C 생성 완료: ${studentId}`);

  return {
    studentId,
    tenantId: metadata.tenantId,
    studentTermId,
    name: "더미학생C_균형형",
    type: "BALANCED",
  };
}

/**
 * 메인 함수
 */
async function main() {
  console.log("🚀 성적 대시보드 API 테스트용 더미 데이터 생성 시작\n");

  try {
    // 메타데이터 조회
    const metadata = await fetchMetadata();

    // 더미 데이터 생성
    const results: DummyDataResult[] = [];

    const studentA = await createStudentA(metadata);
    results.push(studentA);

    const studentB = await createStudentB(metadata);
    results.push(studentB);

    const studentC = await createStudentC(metadata);
    results.push(studentC);

    // 결과 출력
    console.log("\n" + "=".repeat(80));
    console.log("✨ 더미 데이터 생성 완료!");
    console.log("=".repeat(80) + "\n");

    for (const result of results) {
      console.log(`📌 ${result.name} (${result.type})`);
      console.log(`   Student ID: ${result.studentId}`);
      console.log(`   Tenant ID: ${result.tenantId}`);
      console.log(`   Term ID: ${result.studentTermId}`);
      console.log(
        `   API URL: http://localhost:3000/api/students/${result.studentId}/score-dashboard?tenantId=${result.tenantId}&termId=${result.studentTermId}`
      );
      console.log("");
    }

    console.log("=".repeat(80));
    console.log("📝 다음 단계:");
    console.log("   1. API 테스트: npm run test:score-dashboard");
    console.log("   2. 더미 데이터 삭제: npm run cleanup:score-dashboard-dummy");
    console.log("=".repeat(80) + "\n");
  } catch (error: any) {
    console.error("❌ 오류 발생:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// 스크립트 실행
main().catch((error) => {
  console.error("❌ 스크립트 실행 중 오류:", error);
  process.exit(1);
});

