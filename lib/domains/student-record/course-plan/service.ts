// ============================================
// 수강 계획 서비스 — 비즈니스 로직
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";
import * as repo from "./repository";
import {
  getRecommendedCourseNames,
  matchRecommendationsToSubjects,
  assignGradeSemesters,
} from "./recommendation";
import { gradeToSchoolYear, calculateSchoolYear, getCurriculumYear } from "@/lib/utils/schoolYear";
import { saveSetek } from "../service";
import type {
  CoursePlanWithSubject,
  CoursePlanTabData,
  CoursePlanInput,
  OfferedSubjectInfo,
} from "./types";

const LOG_CTX = { domain: "student-record", module: "coursePlan-sync" };

interface SubjectInfo {
  id: string;
  name: string;
  subjectType?: string | null;
  /** Wave 5.1e: exploration_guide_subject_mappings 참조 건수 (canonical 선정용) */
  guideMappingCount?: number;
}

/**
 * 수강 계획 탭 데이터 조회
 */
export async function fetchCoursePlanData(
  studentId: string,
): Promise<CoursePlanTabData> {
  const supabase = await createSupabaseServerClient();

  const [plans, studentResult] = await Promise.all([
    repo.findByStudent(studentId),
    supabase
      .from("students")
      .select("target_major, target_major_2, grade, school_name, tenant_id")
      .eq("id", studentId)
      .single(),
  ]);

  const student = studentResult.data;
  if (!student) {
    return {
      plans: [],
      targetMajor: null,
      targetMajor2: null,
      studentGrade: 1,
      offeredSubjects: [],
      offeredSubjectNames: null,
      curriculumYear: 2015,
      schoolName: null,
    };
  }

  // 학교 개설 과목 조회
  let offeredSubjects: OfferedSubjectInfo[] = [];
  let offeredSubjectNames: string[] | null = null;
  if (student.school_name && student.tenant_id) {
    const { data: schoolProfile } = await supabase
      .from("school_profiles")
      .select("id")
      .eq("tenant_id", student.tenant_id)
      .limit(1)
      .single();

    if (schoolProfile) {
      const { data: offered } = await supabase
        .from("school_offered_subjects")
        .select("subject_id, grades, semesters, subject:subject_id(name)")
        .eq("school_profile_id", schoolProfile.id);

      offeredSubjects = (offered ?? []).map((o) => ({
        subjectId: o.subject_id,
        grades: o.grades ?? [],
        semesters: o.semesters ?? [],
      }));
      offeredSubjectNames = [...new Set(
        (offered ?? [])
          .map((o) => {
            const subj = o.subject as unknown as { name: string } | null;
            return subj?.name;
          })
          .filter((n): n is string => !!n),
      )];
    }
  }

  // 자동 완료 동기화 (성적 존재 → confirmed → completed)
  let finalPlans = plans;
  try {
    const transitioned = await syncScoresToCompleted(studentId);
    if (transitioned > 0) {
      finalPlans = await repo.findByStudent(studentId);
      // 성적 전환 발생 시 학생 전체 엣지 stale 마킹 (파이프라인 재분석 트리거)
      try {
        const { markAllStudentEdgesStale } = await import("../repository/edge-repository");
        await markAllStudentEdgesStale(studentId, "scores_synced");
      } catch { /* fire-and-forget */ }
    }
  } catch (err) {
    logActionError({ ...LOG_CTX, action: "fetchCoursePlanData.syncScores" }, err);
  }

  // 교육과정 연도 판별
  const fetchStudentGrade = student.grade ?? 1;
  const fetchEnrollmentYear = calculateSchoolYear() - fetchStudentGrade + 1;
  const fetchCurriculumYear = getCurriculumYear(fetchEnrollmentYear);

  return {
    plans: finalPlans,
    targetMajor: student.target_major ?? null,
    targetMajor2: (student as Record<string, unknown>).target_major_2 as string | null ?? null,
    studentGrade: fetchStudentGrade,
    offeredSubjects,
    offeredSubjectNames,
    curriculumYear: fetchCurriculumYear,
    schoolName: student.school_name ?? null,
  };
}

/**
 * 추천 생성 + 저장
 */
export async function generateAndSaveRecommendations(
  studentId: string,
  tenantId: string,
): Promise<CoursePlanWithSubject[]> {
  const supabase = await createSupabaseServerClient();

  // 학생 정보 조회
  const { data: student } = await supabase
    .from("students")
    .select("target_major, target_major_2, grade, school_name")
    .eq("id", studentId)
    .single();

  if (!student?.target_major) {
    throw new Error("진로 계열이 설정되어 있지 않습니다.");
  }

  const majorCategories = [student.target_major];
  const major2 = (student as Record<string, unknown>).target_major_2 as string | null;
  if (major2) majorCategories.push(major2);

  // 교육과정 연도 판별
  const studentGrade = student.grade ?? 1;
  const enrollmentYear = calculateSchoolYear() - studentGrade + 1;
  const curriculumYear = getCurriculumYear(enrollmentYear);

  // 1단계: 추천 과목명 추출 (교육과정 연도 반영)
  const recommendations = getRecommendedCourseNames(majorCategories, curriculumYear);

  // 2단계: DB subject 매칭
  // Wave 5.1e: 동명 subject 가 여러 개인 경우 canonical 결정을 위해
  //   exploration_guide_subject_mappings 참조 건수를 함께 주입한다.
  const { data: allSubjects } = await supabase
    .from("subjects")
    .select("id, name, subject_type:subject_type_id ( name )")
    .order("name");

  const { data: mappingRows } = await supabase
    .from("exploration_guide_subject_mappings")
    .select("subject_id");
  const mappingCountBySubject = new Map<string, number>();
  for (const m of mappingRows ?? []) {
    if (!m.subject_id) continue;
    mappingCountBySubject.set(
      m.subject_id,
      (mappingCountBySubject.get(m.subject_id) ?? 0) + 1,
    );
  }

  const subjectInfos: SubjectInfo[] = (allSubjects ?? []).map((s) => {
    // Supabase JOIN은 단일 FK일 때 객체, 복수일 때 배열 반환
    const st = s.subject_type;
    const stObj = Array.isArray(st) ? st[0] : st;
    return {
      id: s.id,
      name: s.name,
      subjectType: (stObj as { name: string } | null)?.name ?? null,
      guideMappingCount: mappingCountBySubject.get(s.id) ?? 0,
    };
  });

  const matched = matchRecommendationsToSubjects(recommendations, subjectInfos);

  // 3단계: 학년/학기 배치
  const existingPlans = await repo.findByStudent(studentId);
  const confirmedOrCompleted = existingPlans.filter(
    (p) => p.plan_status !== "recommended",
  );

  // 이수 과목 (성적이 존재하는 과목)
  const { data: scores } = await supabase
    .from("student_internal_scores")
    .select("subject_id")
    .eq("student_id", studentId);
  const takenSubjectIds = [...new Set((scores ?? []).map((s) => s.subject_id))];

  // 학교 개설 과목
  let offeredSubjects: OfferedSubjectInfo[] = [];
  const { data: schoolProfile } = await supabase
    .from("school_profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();

  if (schoolProfile) {
    const { data: offered } = await supabase
      .from("school_offered_subjects")
      .select("subject_id, grades, semesters")
      .eq("school_profile_id", schoolProfile.id);

    offeredSubjects = (offered ?? []).map((o) => ({
      subjectId: o.subject_id,
      grades: o.grades ?? [],
      semesters: o.semesters ?? [],
    }));
  }

  const courseRecommendations = assignGradeSemesters(
    matched,
    offeredSubjects,
    confirmedOrCompleted,
    takenSubjectIds,
    student.grade ?? 1,
  );

  // Phase 2 Wave 5.1g: 분석 학년(NEIS imported_content 존재하는 학년) 에는
  //   recommended plan 을 만들지 않는다. 이미 이수 확정된 학년에 "추천" 은
  //   무의미하고, UI 에서 세특 영역에 "계획됨" row 가 잘못 뜨는 원인이 된다.
  const { data: importedSeteks } = await supabase
    .from("student_record_seteks")
    .select("grade, imported_content")
    .eq("student_id", studentId)
    .is("deleted_at", null);
  const analysisGrades = new Set<number>();
  for (const s of importedSeteks ?? []) {
    if (s.imported_content && s.imported_content.trim().length > 0) {
      analysisGrades.add(s.grade);
    }
  }
  const designRecommendations = courseRecommendations.filter(
    (r) => !analysisGrades.has(r.grade),
  );

  // 기존 추천 삭제 후 새로 저장
  await repo.removeRecommendedByStudent(studentId);

  const inputs: CoursePlanInput[] = designRecommendations.map((r) => ({
    tenantId,
    studentId,
    subjectId: r.subjectId,
    grade: r.grade,
    semester: r.semester,
    planStatus: "recommended",
    source: "auto",
    recommendationReason: r.reason,
    isSchoolOffered: r.isSchoolOffered,
    priority: r.priority,
  }));

  await repo.bulkUpsert(inputs);

  // 최신 데이터 반환
  return repo.findByStudent(studentId);
}

// ============================================
// P1: 수강 계획 ↔ 세특 동기화
// ============================================

/**
 * confirmed plans에 대해 빈 세특 자동 생성
 * 이미 존재하는 세특은 skip (중복 방지)
 * @returns 생성된 세특 수 + 생성된 세특 목록 (가이드 auto-link용)
 */
export interface SyncSetekResult {
  count: number;
  createdSeteks: Array<{
    id: string;
    subjectId: string;
    grade: number;
    semester: number;
  }>;
}

export async function syncConfirmedToSeteks(
  studentId: string,
  tenantId: string,
  studentGrade: number,
  currentSchoolYear: number,
  targetGrade?: number,
  targetSemester?: number,
): Promise<SyncSetekResult> {
  const supabase = await createSupabaseServerClient();
  const confirmedPlans = await repo.findConfirmedByGradeSemester(
    studentId, targetGrade, targetSemester,
  );

  if (confirmedPlans.length === 0) return { count: 0, createdSeteks: [] };

  let created = 0;
  const createdSeteks: SyncSetekResult["createdSeteks"] = [];

  for (const plan of confirmedPlans) {
    const schoolYear = gradeToSchoolYear(plan.grade, studentGrade, currentSchoolYear);

    // 기존 세특 존재 여부 확인
    const { data: existing } = await supabase
      .from("student_record_seteks")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("school_year", schoolYear)
      .eq("grade", plan.grade)
      .eq("semester", plan.semester)
      .eq("subject_id", plan.subject_id)
      .is("deleted_at", null)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // 빈 세특 생성 (saveSetek 재사용 — 검증 + upsert)
    const result = await saveSetek({
      tenant_id: tenantId,
      student_id: studentId,
      school_year: schoolYear,
      grade: plan.grade,
      semester: plan.semester,
      subject_id: plan.subject_id,
      content: "",
      char_limit: 500,
    });

    if (result.success) {
      created++;
      if (result.id) {
        createdSeteks.push({
          id: result.id,
          subjectId: plan.subject_id,
          grade: plan.grade,
          semester: plan.semester,
        });
      }
    }
  }

  return { count: created, createdSeteks };
}

/**
 * student_internal_scores에 매칭되는 confirmed plans → completed 전환
 * @returns 전환된 plan 수
 */
export async function syncScoresToCompleted(
  studentId: string,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const confirmedPlans = await repo.findConfirmedByGradeSemester(studentId);

  if (confirmedPlans.length === 0) return 0;

  // 성적 데이터에서 (subject_id, grade, semester) 조합 조회
  const { data: scores } = await supabase
    .from("student_internal_scores")
    .select("subject_id, grade, semester")
    .eq("student_id", studentId);

  if (!scores || scores.length === 0) return 0;

  const scoreSet = new Set(
    scores.map((s) => `${s.subject_id}:${s.grade}:${s.semester}`),
  );

  const matchingTriples = confirmedPlans
    .filter((p) => scoreSet.has(`${p.subject_id}:${p.grade}:${p.semester}`))
    .map((p) => ({
      subjectId: p.subject_id,
      grade: p.grade,
      semester: p.semester,
    }));

  if (matchingTriples.length === 0) return 0;

  return repo.bulkCompleteBySubjects(studentId, matchingTriples);
}
