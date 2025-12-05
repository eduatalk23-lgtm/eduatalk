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
  console.error(
    "   NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다."
  );
  console.error("   .env.local 파일에 SUPABASE_SERVICE_ROLE_KEY를 추가하세요.");
  console.error("   Supabase Dashboard → Settings → API → service_role key");
  process.exit(1);
}

// RLS를 우회하기 위해 Service Role Key 사용
// PostgREST 스키마 캐시 문제 해결을 위해 명시적 스키마 지정
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
});

const DUMMY_TAG = "DUMMY_SCORE_TEST";

/**
 * 더미 데이터 생성 결과 타입
 */
type DummyDataResult = {
  studentId: string;
  tenantId: string;
  grade: number;
  semester: number;
  schoolYear: number;
  name: string;
  type: "MOCK_ADVANTAGE" | "INTERNAL_ADVANTAGE" | "BALANCED";
};

/**
 * 테넌트 조회 (이름 기반)
 */
async function getTenantByName(name: string = "Default Tenant"): Promise<string> {
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("name", name)
    .maybeSingle();

  if (tenantError) {
    throw new Error(`테넌트 조회 실패: ${tenantError.message}`);
  }

  if (!tenant) {
    throw new Error(
      `테넌트를 찾을 수 없습니다: ${name}\n   먼저 테넌트를 생성하거나 다른 이름을 사용하세요.`
    );
  }

  console.log(`✅ 테넌트 조회 완료: ${tenant.name} (${tenant.id})`);
  return tenant.id;
}

/**
 * 필요한 메타데이터 조회
 */
async function fetchMetadata() {
  console.log("📋 메타데이터 조회 중...\n");

  // 1. 테넌트 조회 (이름 기반)
  const tenantId = await getTenantByName("Default Tenant");

  // 2. 교육과정 개정 조회 (이름 기반: '2022개정' 또는 '2022 개정' 우선, 없으면 첫 번째 활성화된 것)
  const revisionNames = ["2022개정", "2022 개정"];
  let curriculumRevisionId: string | null = null;
  let foundRevisionName: string | null = null;

  // 여러 이름 패턴 시도
  for (const revisionName of revisionNames) {
    const { data: revision, error: revisionError } = await supabase
      .from("curriculum_revisions")
      .select("id, name")
      .eq("name", revisionName)
      .maybeSingle();

    if (!revisionError && revision) {
      curriculumRevisionId = revision.id;
      foundRevisionName = revision.name;
      break;
    }
  }

  // 찾지 못하면 활성화된 첫 번째 것 사용
  if (!curriculumRevisionId) {
    console.log(`⚠️  '2022개정' 또는 '2022 개정'을 찾을 수 없습니다. 활성화된 교육과정을 조회합니다...`);
    const { data: activeRevision, error: activeError } = await supabase
      .from("curriculum_revisions")
      .select("id, name, year")
      .eq("is_active", true)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError || !activeRevision) {
      throw new Error("활성화된 교육과정 개정을 찾을 수 없습니다.");
    }

    curriculumRevisionId = activeRevision.id;
    foundRevisionName = activeRevision.name;
    console.log(
      `✅ 교육과정 개정 조회 완료: ${activeRevision.name} (${curriculumRevisionId})`
    );
  } else {
    console.log(
      `✅ 교육과정 개정 조회 완료: ${foundRevisionName} (${curriculumRevisionId})`
    );
  }

  // 3. 교과 그룹 조회 (국어, 수학, 영어, 사회, 과학)
  const requiredSubjectGroups = ["국어", "수학", "영어", "사회", "과학"];
  const { data: subjectGroups, error: sgError } = await supabase
    .from("subject_groups")
    .select("id, name")
    .eq("curriculum_revision_id", curriculumRevisionId)
    .in("name", requiredSubjectGroups);

  if (sgError) {
    console.error("❌ 교과 그룹 조회 오류:", sgError.message);
    throw new Error(`교과 그룹 조회 실패: ${sgError.message}`);
  }

  if (!subjectGroups || subjectGroups.length === 0) {
    // 해당 교육과정의 모든 교과 그룹 조회하여 디버깅 정보 제공
    const { data: allGroups } = await supabase
      .from("subject_groups")
      .select("id, name")
      .eq("curriculum_revision_id", curriculumRevisionId);

    const availableNames = allGroups?.map((g) => g.name).join(", ") || "없음";
    throw new Error(
      `필요한 교과 그룹을 찾을 수 없습니다.\n` +
      `  교육과정: ${foundRevisionName}\n` +
      `  필요한 교과: ${requiredSubjectGroups.join(", ")}\n` +
      `  사용 가능한 교과: ${availableNames}\n` +
      `  먼저 교과 그룹 데이터를 생성하세요.`
    );
  }

  // 누락된 교과 그룹이 있으면 자동 생성
  const foundNames = subjectGroups.map((sg) => sg.name);
  const missingNames = requiredSubjectGroups.filter(
    (name) => !foundNames.includes(name)
  );

  if (missingNames.length > 0) {
    console.log(`⚠️  누락된 교과 그룹 발견: ${missingNames.join(", ")}`);
    console.log(`   자동으로 생성합니다...`);

    for (const missingName of missingNames) {
      const { data: newGroup, error: createError } = await supabase
        .from("subject_groups")
        .insert({
          curriculum_revision_id: curriculumRevisionId,
          name: missingName,
        })
        .select("id, name")
        .single();

      if (createError) {
        // 중복 키 오류인 경우 다시 조회
        if (createError.code === "23505") {
          console.log(`   '${missingName}'이 이미 존재합니다. 다시 조회합니다...`);
          const { data: existingGroup, error: retryError } = await supabase
            .from("subject_groups")
            .select("id, name")
            .eq("curriculum_revision_id", curriculumRevisionId)
            .eq("name", missingName)
            .limit(1)
            .maybeSingle();

          if (retryError || !existingGroup) {
            throw new Error(
              `교과 그룹 '${missingName}' 조회 실패: ${retryError?.message || "알 수 없는 오류"}`
            );
          }

          subjectGroups.push(existingGroup);
          console.log(`   ✅ 교과 그룹 조회 완료: ${existingGroup.name} (${existingGroup.id})`);
        } else {
          throw new Error(
            `교과 그룹 '${missingName}' 생성 실패: ${createError.message}`
          );
        }
      } else if (newGroup) {
        subjectGroups.push(newGroup);
        console.log(`   ✅ 교과 그룹 생성 완료: ${newGroup.name} (${newGroup.id})`);
      }
    }
  }

  const subjectGroupMap: Record<string, string> = {};
  for (const sg of subjectGroups) {
    subjectGroupMap[sg.name] = sg.id;
  }

  console.log(`✅ 교과 그룹 조회 완료: ${subjectGroups.length}개`);
  for (const sg of subjectGroups) {
    console.log(`   - ${sg.name} (${sg.id})`);
  }

  // 4. 과목 구분 조회 또는 생성 (공통 우선)
  let commonSubjectTypeId: string;

  // 먼저 조회 시도
  const { data: subjectTypes, error: stError } = await supabase
    .from("subject_types")
    .select("id, name")
    .eq("curriculum_revision_id", curriculumRevisionId)
    .in("name", ["공통", "일반선택"]);

  // 조회 결과 확인
  if (subjectTypes && subjectTypes.length > 0) {
    // 기존 과목 구분 사용
    commonSubjectTypeId =
      subjectTypes.find((st) => st.name === "공통")?.id || subjectTypes[0].id;
    console.log(`✅ 과목 구분 조회 완료: ${subjectTypes.length}개`);
  } else {
    // 과목 구분이 없으면 생성 시도 (중복 시 무시)
    console.log("⚠️  과목 구분이 없습니다. 기본 과목 구분을 생성합니다...");

    // 공통 생성 (중복 시 무시하고 조회)
    const { data: commonType, error: commonError } = await supabase
      .from("subject_types")
      .insert({
        curriculum_revision_id: curriculumRevisionId,
        name: "공통",
        is_active: true,
      })
      .select("id")
      .single();

    if (commonError) {
      // 중복 키 오류인 경우 다시 조회
      if (commonError.code === "23505") {
        console.log("   과목 구분이 이미 존재합니다. 다시 조회합니다...");
        const { data: existingTypes, error: retryError } = await supabase
          .from("subject_types")
          .select("id, name")
          .eq("curriculum_revision_id", curriculumRevisionId)
          .eq("name", "공통")
          .limit(1);

        if (retryError || !existingTypes || existingTypes.length === 0) {
          throw new Error(
            `과목 구분 조회 실패: ${retryError?.message || "알 수 없는 오류"}`
          );
        }

        commonSubjectTypeId = existingTypes[0].id;
        console.log(`✅ 과목 구분 조회 완료: 공통 (${commonSubjectTypeId})`);
      } else {
        throw new Error(`과목 구분 생성 실패: ${commonError.message}`);
      }
    } else if (commonType) {
      commonSubjectTypeId = commonType.id;
      console.log(`✅ 과목 구분 생성 완료: 공통 (${commonSubjectTypeId})`);
    } else {
      throw new Error("과목 구분 생성 실패: 알 수 없는 오류");
    }
  }

  // 5. 과목 조회 (subject_groups 기반 명시적 조회)
  // 각 교과 그룹에서 해당하는 과목을 명시적으로 찾습니다
  const subjectNameMap: Record<string, string[]> = {
    국어: ["국어"],
    수학: ["수학"],
    영어: ["영어"],
    사회: ["통합사회", "사회"],
    과학: ["통합과학", "과학"],
  };

  const subjectMap: Record<string, string> = {};

  for (const [sgName, possibleNames] of Object.entries(subjectNameMap)) {
    const sgId = subjectGroupMap[sgName];
    if (!sgId) {
      console.warn(`⚠️  교과 그룹 '${sgName}'을 찾을 수 없습니다.`);
      continue;
    }

    // 여러 가능한 과목 이름 패턴을 시도
    let subjects: { id: string; name: string } | null = null;
    let foundName: string | null = null;

    for (const subjectName of possibleNames) {
      const { data: subject, error: subError } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("subject_group_id", sgId)
        .eq("name", subjectName)
        .maybeSingle();

      if (!subError && subject) {
        subjects = subject;
        foundName = subjectName;
        break;
      }
    }

    // 명시적인 과목 이름으로 찾지 못한 경우
    if (!subjects) {
      console.log(`   ⚠️  ${sgName} 그룹에서 '${possibleNames.join("', '")}' 과목을 찾을 수 없습니다.`);
      console.log(`   ${sgName} 그룹의 첫 번째 과목을 사용합니다...`);
      
      const { data: firstSubject, error: firstError } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("subject_group_id", sgId)
        .limit(1)
        .maybeSingle();

      if (firstError || !firstSubject) {
        // 과목이 없으면 기본 과목 생성
        console.log(`   ${sgName} 그룹에 과목이 없습니다. 기본 과목을 생성합니다...`);
        
        // 과목 구분 ID 조회 (공통)
        const { data: commonType } = await supabase
          .from("subject_types")
          .select("id")
          .eq("curriculum_revision_id", curriculumRevisionId)
          .eq("name", "공통")
          .limit(1)
          .maybeSingle();

        const defaultSubjectName = possibleNames[0]; // 첫 번째 가능한 이름 사용
        const { data: newSubject, error: createSubError } = await supabase
          .from("subjects")
          .insert({
            subject_group_id: sgId,
            name: defaultSubjectName,
            subject_type_id: commonType?.id || null,
          })
          .select("id, name")
          .single();

        if (createSubError) {
          // 중복 키 오류인 경우 다시 조회
          if (createSubError.code === "23505") {
            const { data: existingSubject } = await supabase
              .from("subjects")
              .select("id, name")
              .eq("subject_group_id", sgId)
              .eq("name", defaultSubjectName)
              .limit(1)
              .maybeSingle();

            if (existingSubject) {
              subjects = existingSubject;
              foundName = defaultSubjectName;
              console.log(`   ✅ ${sgName}: ${subjects.name} (${subjects.id})`);
            } else {
              throw new Error(
                `교과 그룹 '${sgName}'의 과목을 생성/조회할 수 없습니다: ${createSubError.message}`
              );
            }
          } else {
            throw new Error(
              `교과 그룹 '${sgName}'의 과목 생성 실패: ${createSubError.message}`
            );
          }
        } else if (newSubject) {
          subjects = newSubject;
          foundName = defaultSubjectName;
          console.log(`   ✅ ${sgName}: ${subjects.name} (${subjects.id}) - 생성됨`);
        } else {
          throw new Error(`교과 그룹 '${sgName}'의 과목을 생성할 수 없습니다.`);
        }
      } else {
        subjects = firstSubject;
        foundName = firstSubject.name;
        console.log(`   ✅ ${sgName}: ${subjects.name} (${subjects.id}) - 대체 과목 사용`);
      }
    } else {
      console.log(`   ✅ ${sgName}: ${subjects.name} (${subjects.id}) - '${foundName}' 매칭`);
    }

    if (subjects) {
      subjectMap[sgName] = subjects.id;
    }
  }

  if (Object.keys(subjectMap).length < 5) {
    throw new Error("필요한 과목을 모두 찾을 수 없습니다.");
  }

  return {
    tenantId,
    curriculumRevisionId,
    subjectGroupMap,
    commonSubjectTypeId,
    subjectMap, // 이름 기반 Map으로 변경
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
  // students.id는 users.id를 참조하므로, id를 직접 지정
  // 더미 데이터이므로 임시 UUID 사용
  const studentId = randomUUID();

  const { data, error } = await supabase
    .from("students")
    .insert({
      id: studentId,
      tenant_id: tenantId,
      name,
      grade,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`학생 생성 실패: ${error.message}`);
  }

  return data.id;
}

/**
 * 학년도 계산 헬퍼 함수
 * 
 * 현재 날짜를 기준으로 학년도를 계산합니다.
 * 한국의 학년도는 3월부터 시작하므로, 3월~12월은 해당 연도, 1월~2월은 전년도입니다.
 */
function calculateSchoolYear(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1~12

  // 3월~12월: 해당 연도, 1월~2월: 전년도
  if (month >= 3) {
    return year;
  } else {
    return year - 1;
  }
}

/**
 * student_terms 조회 또는 생성
 */
async function getOrCreateStudentTerm(params: {
  tenant_id: string;
  student_id: string;
  school_year: number;
  grade: number;
  semester: number;
  curriculum_revision_id: string;
  class_name?: string | null;
  homeroom_teacher?: string | null;
  notes?: string | null;
}): Promise<string> {
  // 기존 student_term 조회
  const { data: existing, error: selectError } = await supabase
    .from("student_terms")
    .select("id")
    .eq("tenant_id", params.tenant_id)
    .eq("student_id", params.student_id)
    .eq("school_year", params.school_year)
    .eq("grade", params.grade)
    .eq("semester", params.semester)
    .maybeSingle();

  if (selectError) {
    console.error("[seedScoreDashboardDummy] student_term 조회 실패", selectError);
    throw selectError;
  }

  // 기존 student_term이 있으면 반환
  if (existing) {
    return existing.id;
  }

  // 없으면 새로 생성
  const insertPayload = {
    tenant_id: params.tenant_id,
    student_id: params.student_id,
    school_year: params.school_year,
    grade: params.grade,
    semester: params.semester,
    curriculum_revision_id: params.curriculum_revision_id,
    class_name: params.class_name ?? null,
    homeroom_teacher: params.homeroom_teacher ?? null,
    notes: params.notes ?? null,
  };

  const { data: created, error: insertError } = await supabase
    .from("student_terms")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError) {
    console.error("[seedScoreDashboardDummy] student_term 생성 실패", insertError);
    throw insertError;
  }

  return created.id;
}

/**
 * 학생 학기 정보 반환 (student_terms 테이블 조회/생성)
 */
async function getStudentTermInfo(
  tenantId: string,
  studentId: string,
  curriculumRevisionId: string,
  schoolYear: number,
  grade: number,
  semester: number
): Promise<{ grade: number; semester: number; schoolYear: number; studentTermId: string }> {
  const studentTermId = await getOrCreateStudentTerm({
    tenant_id: tenantId,
    student_id: studentId,
    school_year: schoolYear,
    grade,
    semester,
    curriculum_revision_id: curriculumRevisionId,
  });
  
  return { grade, semester, schoolYear, studentTermId };
}

/**
 * 내신 성적 생성 파라미터 타입
 */
type CreateInternalScoreParams = {
  tenantId: string;
  studentId: string;
  studentTermId: string;
  curriculumRevisionId: string;
  subjectGroupId: string;
  subjectTypeId: string;
  subjectId: string;
  grade: number;
  semester: number;
  rankGrade: number;
  creditHours: number;
  rawScore: number;
  avgScore: number;
  stdDev: number;
};

/**
 * 내신 성적 생성 (student_internal_scores 테이블 사용)
 * 
 * 실제 스키마 기준:
 * - tenant_id (NOT NULL)
 * - student_id (NOT NULL)
 * - student_term_id (NOT NULL)
 * - curriculum_revision_id (NOT NULL)
 * - subject_group_id (NOT NULL)
 * - subject_type_id (NOT NULL)
 * - subject_id (NOT NULL)
 * - grade (NOT NULL)
 * - semester (NOT NULL)
 * - rank_grade (nullable)
 * - credit_hours (nullable)
 * - raw_score (nullable)
 * - avg_score (nullable)
 * - std_dev (nullable)
 * - total_students (nullable)
 */
async function createInternalScore(
  params: CreateInternalScoreParams
) {
  const { error } = await supabase.from("student_internal_scores").insert({
    tenant_id: params.tenantId,
    student_id: params.studentId,
    student_term_id: params.studentTermId,
    curriculum_revision_id: params.curriculumRevisionId,
    subject_group_id: params.subjectGroupId,
    subject_type_id: params.subjectTypeId,
    subject_id: params.subjectId,
    grade: params.grade,
    semester: params.semester,
    rank_grade: params.rankGrade,
    credit_hours: params.creditHours,
    raw_score: params.rawScore,
    avg_score: params.avgScore,
    std_dev: params.stdDev,
    total_students: 100,
  });

  if (error) {
    // PGRST205 에러인 경우 상세 정보 출력
    if (error.code === 'PGRST205') {
      console.error('\n⚠️  PGRST205 스키마 캐시 에러 발생');
      console.error('   해결 방법:');
      console.error('   1. Supabase Dashboard → Settings → API → Reload Schema');
      console.error('   2. 또는 몇 분 후 다시 시도');
      console.error(`   에러 상세: ${error.message}`);
    }
    throw new Error(`내신 성적 생성 실패: ${error.message}${error.code ? ` (코드: ${error.code})` : ''}`);
  }
}

/**
 * 모의고사 성적 생성 파라미터 타입
 * 
 * 실제 스키마 기준:
 * - tenant_id (NOT NULL)
 * - student_id (NOT NULL)
 * - grade (NOT NULL, 1~3)
 * - exam_date (NOT NULL)
 * - exam_title (NOT NULL)
 * - subject_id (NOT NULL)
 * - subject_group_id (NOT NULL)
 * - percentile (nullable)
 * - standard_score (nullable)
 * - grade_score (nullable)
 */
type CreateMockScoreParams = {
  tenantId: string;
  studentId: string;
  grade: number; // 학년 (NOT NULL, 1~3)
  examDate: string; // YYYY-MM-DD 형식
  examTitle: string;
  subjectId: string;
  subjectGroupId: string; // 교과 그룹 ID (NOT NULL)
  percentile: number | null;
  standardScore: number | null;
  gradeScore: number | null;
};

/**
 * 모의고사 성적 생성 (student_mock_scores 테이블 사용)
 * 
 * 실제 스키마 기준으로 필수 필드만 사용:
 * - exam_round, exam_type, subject_group (텍스트) 등은 제거
 * - exam_date, exam_title, subject_group_id (UUID) 사용
 */
async function createMockScore(
  params: CreateMockScoreParams
) {
  const { data, error } = await supabase
    .from("student_mock_scores")
    .insert({
      tenant_id: params.tenantId,
      student_id: params.studentId,
      grade: params.grade, // 학년 (NOT NULL)
      exam_date: params.examDate,
      exam_title: params.examTitle,
      subject_id: params.subjectId,
      subject_group_id: params.subjectGroupId, // 교과 그룹 ID (NOT NULL)
      percentile: params.percentile,
      standard_score: params.standardScore,
      grade_score: params.gradeScore,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `모의고사 성적 생성 실패: ${error.message}${
        (error as any).code ? ` (코드: ${(error as any).code})` : ""
      }`
    );
  }

  return data;
}

/**
 * 학생 A 생성 (정시 우위 - MOCK_ADVANTAGE)
 * - 내신: GPA 3.2 근처 (환산 백분위 약 75)
 * - 모의고사: 평백 85 (내신 환산 백분위보다 +10 높음)
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

  if (!metadata.curriculumRevisionId) {
    throw new Error("curriculumRevisionId가 설정되지 않았습니다.");
  }

  const schoolYear = 2025;
  const termInfo = await getStudentTermInfo(
    metadata.tenantId,
    studentId,
    metadata.curriculumRevisionId,
    schoolYear,
    2,
    1
  );

  // 내신 성적 생성 (GPA 3.2 근처 - 환산 백분위 약 75)
  // rank_grade: 평균 3.2 (3등급과 4등급 혼합)
  const internalScores = [
    {
      subjectGroup: "국어",
      rankGrade: 3,
      creditHours: 5,
      rawScore: 73,
      avgScore: 68,
      stdDev: 10,
    },
    {
      subjectGroup: "수학",
      rankGrade: 3,
      creditHours: 5,
      rawScore: 71,
      avgScore: 66,
      stdDev: 12,
    },
    {
      subjectGroup: "영어",
      rankGrade: 3,
      creditHours: 5,
      rawScore: 75,
      avgScore: 70,
      stdDev: 11,
    },
    {
      subjectGroup: "사회",
      rankGrade: 4,
      creditHours: 4,
      rawScore: 66,
      avgScore: 63,
      stdDev: 9,
    },
    {
      subjectGroup: "과학",
      rankGrade: 3,
      creditHours: 4,
      rawScore: 74,
      avgScore: 69,
      stdDev: 10,
    },
  ];

  for (const score of internalScores) {
    const sgId = metadata.subjectGroupMap[score.subjectGroup];
    const subjectId = metadata.subjectMap[score.subjectGroup];

    if (!sgId || !subjectId) {
      throw new Error(`교과 그룹 또는 과목을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

    await createInternalScore({
      tenantId: metadata.tenantId,
      studentId,
      studentTermId: termInfo.studentTermId,
      curriculumRevisionId: metadata.curriculumRevisionId!,
      subjectGroupId: sgId,
      subjectTypeId: metadata.commonSubjectTypeId,
      subjectId,
      grade: termInfo.grade,
      semester: termInfo.semester,
      rankGrade: score.rankGrade,
      creditHours: score.creditHours,
      rawScore: score.rawScore,
      avgScore: score.avgScore,
      stdDev: score.stdDev,
    });
  }

  // 모의고사 성적 생성 (평백 85 - 내신 환산 백분위 75보다 +10 높음)
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

  const examDate = "2025-03-15";
  const examTitle = "2025학년도 3월 모의고사";

  for (const score of mockScores) {
    const subjectId = metadata.subjectMap[score.subjectGroup];
    const subjectGroupId = metadata.subjectGroupMap[score.subjectGroup];

    if (!subjectId) {
      throw new Error(`과목을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

    if (!subjectGroupId) {
      throw new Error(`교과 그룹을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

    await createMockScore({
      tenantId: metadata.tenantId,
      studentId,
      grade: 2, // 2학년 (NOT NULL)
      examDate,
      examTitle,
      subjectId,
      subjectGroupId, // NOT NULL
      percentile: score.percentile,
      standardScore: score.standardScore,
      gradeScore: score.gradeScore,
    });
  }

  console.log(`✅ 학생 A 생성 완료: ${studentId}`);

  return {
    studentId,
    tenantId: metadata.tenantId,
    grade: termInfo.grade,
    semester: termInfo.semester,
    schoolYear: termInfo.schoolYear,
    name: "더미학생A_정시우위",
    type: "MOCK_ADVANTAGE",
  };
}

/**
 * 학생 B 생성 (수시 우위 - INTERNAL_ADVANTAGE)
 * - 내신: GPA 2.0 근처 (환산 백분위 약 89)
 * - 모의고사: 평백 65 (내신 환산 백분위보다 -24 낮음)
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

  if (!metadata.curriculumRevisionId) {
    throw new Error("curriculumRevisionId가 설정되지 않았습니다.");
  }

  const schoolYear = 2025;
  const termInfo = await getStudentTermInfo(
    metadata.tenantId,
    studentId,
    metadata.curriculumRevisionId,
    schoolYear,
    2,
    1
  );

  // 내신 성적 생성 (GPA 2.0 근처 - 환산 백분위 약 89)
  // rank_grade: 평균 2.0 (1등급과 2등급 혼합)
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
    const subjectId = metadata.subjectMap[score.subjectGroup];

    if (!sgId || !subjectId) {
      throw new Error(`교과 그룹 또는 과목을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

    await createInternalScore({
      tenantId: metadata.tenantId,
      studentId,
      studentTermId: termInfo.studentTermId,
      curriculumRevisionId: metadata.curriculumRevisionId!,
      subjectGroupId: sgId,
      subjectTypeId: metadata.commonSubjectTypeId,
      subjectId,
      grade: termInfo.grade,
      semester: termInfo.semester,
      rankGrade: score.rankGrade,
      creditHours: score.creditHours,
      rawScore: score.rawScore,
      avgScore: score.avgScore,
      stdDev: score.stdDev,
    });
  }

  // 모의고사 성적 생성 (평백 65 - 내신 환산 백분위 89보다 -24 낮음)
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

  const examDate = "2025-03-15";
  const examTitle = "2025학년도 3월 모의고사";

  for (const score of mockScores) {
    const subjectId = metadata.subjectMap[score.subjectGroup];
    const subjectGroupId = metadata.subjectGroupMap[score.subjectGroup];

    if (!subjectId) {
      throw new Error(`과목을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

    if (!subjectGroupId) {
      throw new Error(`교과 그룹을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

    await createMockScore({
      tenantId: metadata.tenantId,
      studentId,
      grade: 2, // 2학년 (NOT NULL)
      examDate,
      examTitle,
      subjectId,
      subjectGroupId, // NOT NULL
      percentile: score.percentile,
      standardScore: score.standardScore,
      gradeScore: score.gradeScore,
    });
  }

  console.log(`✅ 학생 B 생성 완료: ${studentId}`);

  return {
    studentId,
    tenantId: metadata.tenantId,
    grade: termInfo.grade,
    semester: termInfo.semester,
    schoolYear: termInfo.schoolYear,
    name: "더미학생B_수시우위",
    type: "INTERNAL_ADVANTAGE",
  };
}

/**
 * 학생 C 생성 (BALANCED)
 * - 내신: GPA 2.5 근처 (환산 백분위 약 82)
 * - 모의고사: 평백 80 (내신 환산 백분위와 차이 -2, -3~+3 범위 내)
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

  if (!metadata.curriculumRevisionId) {
    throw new Error("curriculumRevisionId가 설정되지 않았습니다.");
  }

  const schoolYear = 2025;
  const termInfo = await getStudentTermInfo(
    metadata.tenantId,
    studentId,
    metadata.curriculumRevisionId,
    schoolYear,
    2,
    1
  );

  // 내신 성적 생성 (GPA 2.5 근처 - 환산 백분위 약 82)
  // rank_grade: 평균 2.5 (2등급과 3등급 혼합)
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
    const subjectId = metadata.subjectMap[score.subjectGroup];

    if (!sgId || !subjectId) {
      throw new Error(`교과 그룹 또는 과목을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

    await createInternalScore({
      tenantId: metadata.tenantId,
      studentId,
      studentTermId: termInfo.studentTermId,
      curriculumRevisionId: metadata.curriculumRevisionId!,
      subjectGroupId: sgId,
      subjectTypeId: metadata.commonSubjectTypeId,
      subjectId,
      grade: termInfo.grade,
      semester: termInfo.semester,
      rankGrade: score.rankGrade,
      creditHours: score.creditHours,
      rawScore: score.rawScore,
      avgScore: score.avgScore,
      stdDev: score.stdDev,
    });
  }

  // 모의고사 성적 생성 (평백 80 - 내신 환산 백분위 82와 차이 -2)
  const mockScores = [
    {
      subjectGroup: "국어",
      percentile: 80,
      standardScore: 128,
      gradeScore: 3,
    },
    {
      subjectGroup: "수학",
      percentile: 79,
      standardScore: 127,
      gradeScore: 3,
    },
    {
      subjectGroup: "영어",
      percentile: 81,
      standardScore: 129,
      gradeScore: 3,
    },
    {
      subjectGroup: "사회",
      percentile: 78,
      standardScore: 125,
      gradeScore: 3,
    },
    {
      subjectGroup: "과학",
      percentile: 82,
      standardScore: 130,
      gradeScore: 2,
    },
  ];

  const examDate = "2025-03-15";
  const examTitle = "2025학년도 3월 모의고사";

  for (const score of mockScores) {
    const subjectId = metadata.subjectMap[score.subjectGroup];
    const subjectGroupId = metadata.subjectGroupMap[score.subjectGroup];

    if (!subjectId) {
      throw new Error(`과목을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

    if (!subjectGroupId) {
      throw new Error(`교과 그룹을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

    await createMockScore({
      tenantId: metadata.tenantId,
      studentId,
      grade: 2, // 2학년 (NOT NULL)
      examDate,
      examTitle,
      subjectId,
      subjectGroupId, // NOT NULL
      percentile: score.percentile,
      standardScore: score.standardScore,
      gradeScore: score.gradeScore,
    });
  }

  console.log(`✅ 학생 C 생성 완료: ${studentId}`);

  return {
    studentId,
    tenantId: metadata.tenantId,
    grade: termInfo.grade,
    semester: termInfo.semester,
    schoolYear: termInfo.schoolYear,
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
      console.log(`📌 ${result.name}`);
      console.log(`   예상 전략 타입: ${result.type}`);
      console.log(`   Student ID: ${result.studentId}`);
      console.log(`   Tenant ID: ${result.tenantId}`);
      console.log(`   학년: ${result.grade}, 학기: ${result.semester}, 학년도: ${result.schoolYear}`);
        console.log(
        `   API URL: http://localhost:3000/api/students/${result.studentId}/score-dashboard?tenantId=${result.tenantId}&grade=${result.grade}&semester=${result.semester}`
      );
      console.log("");
    }

    console.log("=".repeat(80));
    console.log("📝 다음 단계:");
    console.log("   1. 더미 데이터 생성 완료!");
    console.log("   2. API 테스트:");
    console.log("      npx tsx scripts/testScoreDashboard.ts");
    console.log("   3. 또는 브라우저에서 직접 확인:");
    console.log("      위에 출력된 API URL을 브라우저에서 열어보세요.");
    console.log("   4. 더미 데이터 삭제:");
    console.log("      npm run cleanup:score-dashboard-dummy");
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
