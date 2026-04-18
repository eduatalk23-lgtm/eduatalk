#!/usr/bin/env npx tsx
/**
 * seed-xrun-01: Cross-run 심화 측정용 전용 시드 학생.
 *
 * 김세린(analysis) / 인제고(prospective) 와 별개의 통제된 시드 학생으로,
 * "신규 기록 투입 후 Run N→N+1 에서 narrative/grade_theme 심화/확장 여부" 를 측정한다.
 *
 * 기존 reference 학생(김세린/인제고)은 "분기별 교차 검증 기준" 으로 고정되어 있어
 * 레코드 증분 투입이 baseline 을 오염시키므로 별도 시드를 둔다.
 *
 * 사용:
 *   npx tsx scripts/seed-xrun-student.ts --apply-baseline    # Run 1 직전 상태 구축
 *   npx tsx scripts/seed-xrun-student.ts --apply-delta       # Run 2 직전 신규 기록 투입
 *   npx tsx scripts/seed-xrun-student.ts --status            # 현재 DB 상태 요약
 *   npx tsx scripts/seed-xrun-student.ts --rollback          # 전체 제거 (실험 초기화)
 *
 * 측정 흐름:
 *   1) --apply-baseline → synthesis 파이프라인 실행 (Run 1)
 *   2) cross-run-snapshot.ts 로 Run 1 산출물 스냅샷
 *   3) --apply-delta → synthesis 재실행 (Run 2)
 *   4) cross-run-snapshot.ts 로 Run 2 스냅샷
 *   5) cross-run-diff.ts + cross-run-consumer-diff.ts 로 심화/확장 여부 판단
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}
const sb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "public" },
});

// ────────────────────────────────────────────────────────────────────
// 상수
// ────────────────────────────────────────────────────────────────────

const TENANT_ID = "84b71a5d-5681-4da3-88d2-91e75ef89015"; // 김세린/인제고와 동일
const STUDENT_ID = "c0ffee01-5eed-4d00-9000-000000000001"; // 결정적 UUID
const STUDENT_NAME = "xrun-seed-01";
const SCHOOL_NAME = "시드고등학교";
const CURRICULUM_NAME = "2022 개정";
// target_major 는 MAJOR_RECOMMENDED_COURSES_2022 의 카테고리 키와 일치해야 한다.
// 데이터사이언스/통계 학과는 실제로 "수리·통계" + "컴퓨터·정보" 복수 전공으로 모델링.
const TARGET_MAJOR = "수리·통계";
const TARGET_MAJOR_2 = "컴퓨터·정보";
const EXAM_YEAR = 2028; // 2학년 2026년도 기준 → 2028 수능
const CURRENT_GRADE = 2;

// 학년도 매핑: 1학년=2025, 2학년=2026
const SCHOOL_YEAR_BY_GRADE: Record<number, number> = { 1: 2025, 2: 2026, 3: 2027 };

// ────────────────────────────────────────────────────────────────────
// 과목 이름 → ID 해석
// ────────────────────────────────────────────────────────────────────

type SubjectMap = Record<string, string>;

async function resolveSubjects(names: string[]): Promise<SubjectMap> {
  const { data, error } = await sb
    .from("subjects")
    .select("id, name, subject_groups!inner(curriculum_revisions!inner(name))")
    .in("name", names)
    .eq("subject_groups.curriculum_revisions.name", CURRICULUM_NAME);
  if (error) throw new Error(`subjects 조회 실패: ${error.message}`);
  const map: SubjectMap = {};
  for (const row of data ?? []) map[row.name as string] = row.id as string;
  const missing = names.filter((n) => !map[n]);
  if (missing.length > 0) {
    throw new Error(`${CURRICULUM_NAME} 과목 누락: ${missing.join(", ")}`);
  }
  return map;
}

async function resolveCurriculumRevisionId(): Promise<string> {
  const { data, error } = await sb
    .from("curriculum_revisions")
    .select("id")
    .eq("name", CURRICULUM_NAME)
    .maybeSingle();
  if (error) throw new Error(`curriculum_revisions 조회 실패: ${error.message}`);
  if (!data) throw new Error(`curriculum '${CURRICULUM_NAME}' not found`);
  return data.id as string;
}

// ────────────────────────────────────────────────────────────────────
// 시드 데이터 정의
// ────────────────────────────────────────────────────────────────────

type SeteukRecord = {
  grade: number;
  semester: 1 | 2;
  subjectName: string;
  content: string;
};

type ChangcheRecord = {
  grade: number;
  activity_type: "autonomy" | "club" | "career";
  hours: number;
  content: string;
};

type ReadingRecord = {
  grade: number;
  subject_area: string;
  book_title: string;
  author: string;
  notes: string;
  is_recommended: boolean;
};

type HaengteukRecord = { grade: number; content: string };

// Baseline: Run 1 직전. 1학년 전학기 + 5 cross-run 축 전부 작동 가능한 최소.
const BASELINE_SETEKS: SeteukRecord[] = [
  {
    grade: 1,
    semester: 1,
    subjectName: "공통수학1",
    content:
      "방정식과 부등식 단원에서 자료 분포 요약 활동에 자발적으로 참여함. 학급 친구들의 일일 학습 시간을 설문 수집해 산포도와 평균·표준편차를 계산하고, 이상치를 탐지하는 기준에 관심을 보여 수치 자료가 의사결정에 어떻게 쓰이는지 토론에 주도적으로 참여함.",
  },
  {
    grade: 1,
    semester: 1,
    subjectName: "공통국어1",
    content:
      "논설문 단원에서 '데이터로 말한다는 것은 무엇인가' 를 주제로 독서 기반 논증 글을 작성함. 설문 표본 편향, 인과·상관 혼동 등 통계 오류 사례를 자기 논거로 삼으며 통계적 증거와 수사적 호소를 구별하려는 태도를 보임.",
  },
  {
    grade: 1,
    semester: 2,
    subjectName: "공통수학2",
    content:
      "함수와 그래프 단원을 실생활 자료 해석으로 확장하여 탐구 보고서를 작성함. 교내 학습 시간-성적 상관 자료를 산점도로 시각화하고 일차·지수 모형의 적합도를 비교하며, 모형이 실제 현상의 복잡성을 얼마나 단순화하는지에 대한 반성적 고찰을 제시함.",
  },
  {
    grade: 1,
    semester: 2,
    subjectName: "통합과학2",
    content:
      "지구환경 단원에서 기후 관측 자료 분석 활동을 주도함. 공개 기상청 데이터를 내려받아 연도별 평균기온 추세를 선형회귀로 근사하고 잔차의 분포를 관찰함으로써, 자료를 '보이는 그대로' 가 아닌 '해석되는 구조' 로 다루려는 태도를 길렀다는 평가를 받음.",
  },
];

const BASELINE_CHANGCHE: ChangcheRecord[] = [
  {
    grade: 1,
    activity_type: "autonomy",
    hours: 6,
    content:
      "학급자치 활동으로 '학급 의사결정 투명성' 프로젝트를 제안·진행함. 학급 내 의견 설문을 설계하고 응답을 익명 집계한 뒤 결과를 막대그래프/히트맵으로 공유하여, 다수결 이전에 구성원 간 선호 분포를 공유하는 의사결정 문화를 정착시키는 데 기여함.",
  },
  {
    grade: 1,
    activity_type: "club",
    hours: 34,
    content:
      "수학·통계 탐구 동아리 '데이터 아뜰리에' 에서 학습 시간과 평가 점수의 상관관계를 미니 프로젝트로 분석함. 피어슨 상관계수와 스피어만 순위상관의 차이를 직접 계산해 보고, 상관이 인과를 보장하지 않는다는 점을 사례로 설명하는 보고서를 작성함.",
  },
  {
    grade: 1,
    activity_type: "career",
    hours: 10,
    content:
      "진로탐색 활동으로 '데이터 사이언티스트 직무' 를 선정하고 자기주도 탐색을 수행함. 전공(통계학·산업공학·컴퓨터과학) 간 접근 방식 차이를 정리하고, 공공데이터포털과 Kaggle 사례를 통해 실무가 요구하는 문제정의-전처리-모형-해석의 단계별 역량을 구조화함.",
  },
];

const BASELINE_READING: ReadingRecord[] = [
  {
    grade: 1,
    subject_area: "수학",
    book_title: "통계학 도감",
    author: "쿠리하라 신이치",
    notes:
      "평균·중앙값·분산 같은 기초 통계량을 일상 사례로 풀어내어 '왜 하필 이 수치가 대푯값이 되는가' 에 대한 직관을 얻음. 자료의 분포 형태에 따라 대푯값 선택이 달라진다는 점을 학급 설문 프로젝트에 적용함.",
    is_recommended: true,
  },
  {
    grade: 1,
    subject_area: "정보",
    book_title: "데이터는 언제나 옳은가",
    author: "강양구",
    notes:
      "측정·집계 과정에서 발생하는 편향과 누락이 어떻게 '객관적 수치' 의 외형을 띠는지에 대한 비판적 시각을 얻음. 같은 데이터라도 해석 프레임에 따라 결론이 바뀔 수 있음을 진로 탐색 보고서에 반영함.",
    is_recommended: true,
  },
  {
    grade: 1,
    subject_area: "과학",
    book_title: "컴퓨터과학이 여는 세계",
    author: "이광근",
    notes:
      "알고리즘·계산 복잡도·추상화 개념을 통해 데이터 처리의 효율성과 한계를 이해함. 대용량 자료 분석이 단순 암산의 확장이 아니라 계산 모델 선택의 문제임을 학습하여 이후 통계 프로젝트에서 도구 선택 기준으로 삼음.",
    is_recommended: false,
  },
];

const BASELINE_HAENGTEUK: HaengteukRecord[] = [
  {
    grade: 1,
    content:
      "자료와 수치를 근거로 판단하는 태도가 뚜렷한 학생으로, 주장과 근거를 구분하고 반례를 찾으려는 습관이 학급 토론에서 자주 관찰됨. 관찰 대상을 단순 소비자가 아닌 분석 대상으로 바라볼 줄 알며, 동료의 의견을 수치로 재구성해 공유하는 리더십을 보여 모둠 활동에서 신뢰받는 역할을 수행함.",
  },
];

// Delta: Run 2 직전 투입. 심화 1건(기존 주제 deepen) + 확장 1건(인접 keyword 도입).
const DELTA_SETEKS: SeteukRecord[] = [
  {
    grade: 2,
    semester: 1,
    subjectName: "확률과 통계",
    content:
      "베이지안 추론 프로젝트를 스스로 주제화하여 학급 시험 점수의 사전/사후 분포를 베타 분포로 모델링함. 빈도주의와 베이지안 접근의 전제 차이를 발표 자료로 정리하고, 사전분포 선택이 결론에 끼치는 영향을 시뮬레이션으로 검증하여 통계적 판단이 '정답 도출' 이 아닌 '불확실성 표현' 이라는 이해에 도달함.",
  },
];

const DELTA_CHANGCHE: ChangcheRecord[] = [
  {
    grade: 2,
    activity_type: "career",
    hours: 8,
    content:
      "진로활동으로 '데이터 윤리와 알고리즘 편향' 주제 심화 발표를 수행함. 채용·신용평가·재범예측 알고리즘의 실제 편향 사례를 검토하고, 프라이버시 보존 기법(차등 프라이버시·연합학습)의 원리와 한계를 소개하여 기술의 효율과 권리 보호 사이의 긴장관계를 청중에게 환기함.",
  },
];

// ────────────────────────────────────────────────────────────────────
// 업서트 로직
// ────────────────────────────────────────────────────────────────────

async function ensureProfile(): Promise<void> {
  const { data: existing } = await sb
    .from("user_profiles")
    .select("id")
    .eq("id", STUDENT_ID)
    .maybeSingle();
  if (existing) return;
  const { error } = await sb.from("user_profiles").insert({
    id: STUDENT_ID,
    tenant_id: TENANT_ID,
    role: "student",
    name: STUDENT_NAME,
    is_active: true,
  });
  if (error) throw new Error(`user_profiles insert 실패: ${error.message}`);
  console.log(`  • user_profiles 생성: ${STUDENT_ID}`);
}

async function ensureStudent(): Promise<void> {
  const { data: existing } = await sb
    .from("students")
    .select("id")
    .eq("id", STUDENT_ID)
    .maybeSingle();
  if (existing) return;
  const { error } = await sb.from("students").insert({
    id: STUDENT_ID,
    tenant_id: TENANT_ID,
    grade: CURRENT_GRADE,
    status: "enrolled",
    school_name: SCHOOL_NAME,
    curriculum_revision: CURRICULUM_NAME,
    exam_year: EXAM_YEAR,
    target_major: TARGET_MAJOR,
    target_major_2: TARGET_MAJOR_2,
  });
  if (error) throw new Error(`students insert 실패: ${error.message}`);
  console.log(`  • students 생성: grade=${CURRENT_GRADE}, major='${TARGET_MAJOR}'`);
}

async function ensureStudentTerm(grade: number, semester: 1 | 2, curriculumRevisionId: string): Promise<string> {
  const schoolYear = SCHOOL_YEAR_BY_GRADE[grade];
  const { data: existing } = await sb
    .from("student_terms")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("student_id", STUDENT_ID)
    .eq("school_year", schoolYear)
    .eq("grade", grade)
    .eq("semester", semester)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data: inserted, error } = await sb
    .from("student_terms")
    .insert({
      tenant_id: TENANT_ID,
      student_id: STUDENT_ID,
      school_year: schoolYear,
      grade,
      semester,
      curriculum_revision_id: curriculumRevisionId,
    })
    .select("id")
    .single();
  if (error || !inserted) throw new Error(`student_terms insert 실패(${grade}-${semester}): ${error?.message}`);
  return inserted.id as string;
}

async function insertSeteks(rows: SeteukRecord[], subjectMap: SubjectMap): Promise<void> {
  for (const r of rows) {
    const schoolYear = SCHOOL_YEAR_BY_GRADE[r.grade];
    const subjectId = subjectMap[r.subjectName];
    if (!subjectId) throw new Error(`subject id 없음: ${r.subjectName}`);
    // 중복 체크
    const { data: dup } = await sb
      .from("student_record_seteks")
      .select("id")
      .eq("tenant_id", TENANT_ID)
      .eq("student_id", STUDENT_ID)
      .eq("school_year", schoolYear)
      .eq("grade", r.grade)
      .eq("semester", r.semester)
      .eq("subject_id", subjectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (dup) {
      console.log(`  • seteks 스킵(존재): ${r.grade}-${r.semester} ${r.subjectName}`);
      continue;
    }
    const { error } = await sb.from("student_record_seteks").insert({
      tenant_id: TENANT_ID,
      student_id: STUDENT_ID,
      school_year: schoolYear,
      grade: r.grade,
      semester: r.semester,
      subject_id: subjectId,
      content: r.content,
      status: "final",
    });
    if (error) throw new Error(`seteks insert 실패(${r.subjectName}): ${error.message}`);
    console.log(`  • seteks 추가: ${r.grade}-${r.semester} ${r.subjectName} (${r.content.length}자)`);
  }
}

async function insertChangche(rows: ChangcheRecord[]): Promise<void> {
  for (const r of rows) {
    const schoolYear = SCHOOL_YEAR_BY_GRADE[r.grade];
    const { data: dup } = await sb
      .from("student_record_changche")
      .select("id")
      .eq("tenant_id", TENANT_ID)
      .eq("student_id", STUDENT_ID)
      .eq("school_year", schoolYear)
      .eq("grade", r.grade)
      .eq("activity_type", r.activity_type)
      .is("deleted_at", null)
      .maybeSingle();
    if (dup) {
      console.log(`  • changche 스킵(존재): G${r.grade} ${r.activity_type}`);
      continue;
    }
    const { error } = await sb.from("student_record_changche").insert({
      tenant_id: TENANT_ID,
      student_id: STUDENT_ID,
      school_year: schoolYear,
      grade: r.grade,
      activity_type: r.activity_type,
      hours: r.hours,
      content: r.content,
      status: "final",
    });
    if (error) throw new Error(`changche insert 실패(${r.activity_type}): ${error.message}`);
    console.log(`  • changche 추가: G${r.grade} ${r.activity_type} (${r.hours}h, ${r.content.length}자)`);
  }
}

async function insertReading(rows: ReadingRecord[]): Promise<void> {
  for (const r of rows) {
    const schoolYear = SCHOOL_YEAR_BY_GRADE[r.grade];
    // reading 은 UNIQUE 가 없어 book_title 로만 중복 체크
    const { data: dup } = await sb
      .from("student_record_reading")
      .select("id")
      .eq("tenant_id", TENANT_ID)
      .eq("student_id", STUDENT_ID)
      .eq("school_year", schoolYear)
      .eq("grade", r.grade)
      .eq("book_title", r.book_title)
      .maybeSingle();
    if (dup) {
      console.log(`  • reading 스킵(존재): G${r.grade} ${r.book_title}`);
      continue;
    }
    const { error } = await sb.from("student_record_reading").insert({
      tenant_id: TENANT_ID,
      student_id: STUDENT_ID,
      school_year: schoolYear,
      grade: r.grade,
      subject_area: r.subject_area,
      book_title: r.book_title,
      author: r.author,
      notes: r.notes,
      is_recommended: r.is_recommended,
    });
    if (error) throw new Error(`reading insert 실패(${r.book_title}): ${error.message}`);
    console.log(`  • reading 추가: G${r.grade} ${r.book_title}`);
  }
}

async function insertHaengteuk(rows: HaengteukRecord[]): Promise<void> {
  for (const r of rows) {
    const schoolYear = SCHOOL_YEAR_BY_GRADE[r.grade];
    const { data: dup } = await sb
      .from("student_record_haengteuk")
      .select("id")
      .eq("tenant_id", TENANT_ID)
      .eq("student_id", STUDENT_ID)
      .eq("school_year", schoolYear)
      .eq("grade", r.grade)
      .is("deleted_at", null)
      .maybeSingle();
    if (dup) {
      console.log(`  • haengteuk 스킵(존재): G${r.grade}`);
      continue;
    }
    const { error } = await sb.from("student_record_haengteuk").insert({
      tenant_id: TENANT_ID,
      student_id: STUDENT_ID,
      school_year: schoolYear,
      grade: r.grade,
      content: r.content,
      status: "final",
    });
    if (error) throw new Error(`haengteuk insert 실패(G${r.grade}): ${error.message}`);
    console.log(`  • haengteuk 추가: G${r.grade} (${r.content.length}자)`);
  }
}

// ────────────────────────────────────────────────────────────────────
// 커맨드
// ────────────────────────────────────────────────────────────────────

async function applyBaseline(): Promise<void> {
  console.log("🌱 baseline 투입 시작\n");
  const curriculumRevisionId = await resolveCurriculumRevisionId();
  const subjectNames = [...new Set(BASELINE_SETEKS.map((r) => r.subjectName))];
  const subjectMap = await resolveSubjects(subjectNames);

  await ensureProfile();
  await ensureStudent();
  const termsNeeded: Array<[number, 1 | 2]> = [
    [1, 1],
    [1, 2],
  ];
  for (const [g, s] of termsNeeded) await ensureStudentTerm(g, s, curriculumRevisionId);

  await insertSeteks(BASELINE_SETEKS, subjectMap);
  await insertChangche(BASELINE_CHANGCHE);
  await insertReading(BASELINE_READING);
  await insertHaengteuk(BASELINE_HAENGTEUK);
  console.log(`\n✅ baseline 완료 — Student ID: ${STUDENT_ID}`);
  console.log(`   다음: synthesis 파이프라인 실행 → cross-run-snapshot (label: run1-post)`);
}

async function applyDelta(): Promise<void> {
  console.log("💧 delta 투입 시작\n");
  const curriculumRevisionId = await resolveCurriculumRevisionId();
  const subjectNames = [...new Set(DELTA_SETEKS.map((r) => r.subjectName))];
  const subjectMap = await resolveSubjects(subjectNames);

  // 2학년 1학기 term 필요
  await ensureStudentTerm(2, 1, curriculumRevisionId);

  await insertSeteks(DELTA_SETEKS, subjectMap);
  await insertChangche(DELTA_CHANGCHE);
  console.log(`\n✅ delta 완료 — 심화 1건(베이지안 추론) + 확장 1건(데이터 윤리 심화)`);
  console.log(`   다음: synthesis 재실행 → cross-run-snapshot (label: run2-post)`);
}

async function status(): Promise<void> {
  const [{ data: profile }, { data: student }, { count: setekCount }, { count: changcheCount }, { count: readingCount }, { count: haengteukCount }, { count: termCount }] =
    await Promise.all([
      sb.from("user_profiles").select("id, name, role").eq("id", STUDENT_ID).maybeSingle(),
      sb.from("students").select("id, grade, target_major, exam_year, curriculum_revision").eq("id", STUDENT_ID).maybeSingle(),
      sb.from("student_record_seteks").select("id", { count: "exact", head: true }).eq("student_id", STUDENT_ID).is("deleted_at", null),
      sb.from("student_record_changche").select("id", { count: "exact", head: true }).eq("student_id", STUDENT_ID).is("deleted_at", null),
      sb.from("student_record_reading").select("id", { count: "exact", head: true }).eq("student_id", STUDENT_ID),
      sb.from("student_record_haengteuk").select("id", { count: "exact", head: true }).eq("student_id", STUDENT_ID).is("deleted_at", null),
      sb.from("student_terms").select("id", { count: "exact", head: true }).eq("student_id", STUDENT_ID),
    ]);

  console.log(`📊 seed-xrun-01 상태`);
  console.log(`   student_id: ${STUDENT_ID}`);
  console.log(`   user_profiles: ${profile ? `✓ ${profile.name} (${profile.role})` : "✗ 없음"}`);
  console.log(`   students:      ${student ? `✓ grade=${student.grade} major='${student.target_major}' exam=${student.exam_year}` : "✗ 없음"}`);
  console.log(`   student_terms: ${termCount ?? 0}건`);
  console.log(`   seteks:        ${setekCount ?? 0}건`);
  console.log(`   changche:      ${changcheCount ?? 0}건`);
  console.log(`   reading:       ${readingCount ?? 0}건`);
  console.log(`   haengteuk:     ${haengteukCount ?? 0}건`);
}

async function rollback(): Promise<void> {
  console.log("🗑  seed-xrun-01 전체 제거 시작\n");
  const tables = [
    "student_record_seteks",
    "student_record_personal_seteks",
    "student_record_changche",
    "student_record_haengteuk",
    "student_record_reading",
  ];
  for (const t of tables) {
    const { error, count } = await sb.from(t).delete({ count: "exact" }).eq("student_id", STUDENT_ID);
    if (error) console.warn(`  ⚠️  ${t} 삭제 실패: ${error.message}`);
    else console.log(`  • ${t}: ${count ?? 0}건 삭제`);
  }
  // term / student / profile
  const { error: termErr, count: termCount } = await sb.from("student_terms").delete({ count: "exact" }).eq("student_id", STUDENT_ID);
  if (termErr) console.warn(`  ⚠️  student_terms 삭제 실패: ${termErr.message}`);
  else console.log(`  • student_terms: ${termCount ?? 0}건 삭제`);

  const { error: stuErr } = await sb.from("students").delete().eq("id", STUDENT_ID);
  if (stuErr) console.warn(`  ⚠️  students 삭제 실패: ${stuErr.message}`);
  else console.log(`  • students: 1건 삭제`);

  const { error: profErr } = await sb.from("user_profiles").delete().eq("id", STUDENT_ID);
  if (profErr) console.warn(`  ⚠️  user_profiles 삭제 실패: ${profErr.message}`);
  else console.log(`  • user_profiles: 1건 삭제`);

  console.log("\n✅ rollback 완료");
}

// ────────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const cmd = args.find((a) => a.startsWith("--"));
  switch (cmd) {
    case "--apply-baseline":
      await applyBaseline();
      break;
    case "--apply-delta":
      await applyDelta();
      break;
    case "--status":
      await status();
      break;
    case "--rollback":
      await rollback();
      break;
    default:
      console.log(`사용:
  npx tsx scripts/seed-xrun-student.ts --apply-baseline
  npx tsx scripts/seed-xrun-student.ts --apply-delta
  npx tsx scripts/seed-xrun-student.ts --status
  npx tsx scripts/seed-xrun-student.ts --rollback`);
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌", e.message ?? e);
    process.exit(1);
  });
