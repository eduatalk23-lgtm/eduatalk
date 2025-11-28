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

  // 5. 과목 조회 (이름 기반: 각 교과 그룹에서 특정 과목 이름으로 조회)
  const subjectNameMap: Record<string, string> = {
    국어: "국어",
    수학: "수학",
    영어: "영어",
    사회: "통합사회",
    과학: "통합과학",
  };

  const subjectMap: Record<string, string> = {};

  for (const [sgName, subjectName] of Object.entries(subjectNameMap)) {
    const sgId = subjectGroupMap[sgName];
    if (!sgId) {
      console.warn(`⚠️  교과 그룹 '${sgName}'을 찾을 수 없습니다.`);
      continue;
    }

    // 먼저 정확한 이름으로 조회
    let { data: subjects, error: subError } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("subject_group_id", sgId)
      .eq("name", subjectName)
      .maybeSingle();

      // 정확한 이름으로 찾지 못하면 해당 교과 그룹의 첫 번째 과목 사용
      if (subError || !subjects) {
        console.log(`   '${subjectName}'을 찾을 수 없습니다. ${sgName} 그룹의 첫 번째 과목을 사용합니다...`);
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

          const defaultSubjectName = subjectNameMap[sgName]; // 원래 찾으려던 과목 이름
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
            console.log(`   ✅ ${sgName}: ${subjects.name} (${subjects.id}) - 생성됨`);
          } else {
            throw new Error(`교과 그룹 '${sgName}'의 과목을 생성할 수 없습니다.`);
          }
        } else {
          subjects = firstSubject;
          console.log(`   ✅ ${sgName}: ${subjects.name} (${subjects.id})`);
        }
      } else {
        console.log(`   ✅ ${sgName}: ${subjects.name} (${subjects.id})`);
      }

      subjectMap[sgName] = subjects.id;
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

  const studentTermId = await createStudentTerm(
    metadata.tenantId,
    studentId,
    metadata.curriculumRevisionId,
    2025,
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

  // 모의고사 성적 생성 (평백 85 - 내신 환산 백분위 75보다 +10 높음)
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
    const subjectId = metadata.subjectMap[score.subjectGroup];

    if (!sgId || !subjectId) {
      throw new Error(`교과 그룹 또는 과목을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

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

  const studentTermId = await createStudentTerm(
    metadata.tenantId,
    studentId,
    metadata.curriculumRevisionId,
    2025,
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

  // 모의고사 성적 생성 (평백 65 - 내신 환산 백분위 89보다 -24 낮음)
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
    const subjectId = metadata.subjectMap[score.subjectGroup];

    if (!sgId || !subjectId) {
      throw new Error(`교과 그룹 또는 과목을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

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

  const studentTermId = await createStudentTerm(
    metadata.tenantId,
    studentId,
    metadata.curriculumRevisionId,
    2025,
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

  // 모의고사 성적 생성 (평백 80 - 내신 환산 백분위 82와 차이 -2)
  const examDate = "2025-06-01";
  const examTitle = "2025-06 모평";

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

  for (const score of mockScores) {
    const sgId = metadata.subjectGroupMap[score.subjectGroup];
    const subjectId = metadata.subjectMap[score.subjectGroup];

    if (!sgId || !subjectId) {
      throw new Error(`교과 그룹 또는 과목을 찾을 수 없습니다: ${score.subjectGroup}`);
    }

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
      console.log(`📌 ${result.name}`);
      console.log(`   예상 전략 타입: ${result.type}`);
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
    console.log(
      "   2. 더미 데이터 삭제: npm run cleanup:score-dashboard-dummy"
    );
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
