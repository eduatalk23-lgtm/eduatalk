import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  UniversityDepartment,
  DepartmentWithCurriculum,
  DepartmentCurriculum,
  DepartmentClassification,
  BypassMajorPair,
  BypassMajorCandidate,
  BypassCandidateWithDetails,
  BypassCandidateStatus,
  DepartmentSearchFilter,
  CurriculumCompareResult,
  UniversityTransferPolicy,
} from "./types";
import {
  calculateCurriculumSimilarity,
  type CourseWithType,
} from "./similarity-engine";

// ============================================================
// 1. 학과 조회
// ============================================================

/** 학과 검색 (페이지네이션 + trigram/ilike 매칭) */
export async function searchDepartments(filter: DepartmentSearchFilter) {
  const supabase = await createSupabaseServerClient();
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("university_departments")
    .select("*", { count: "exact" })
    .order("university_name")
    .order("department_name")
    .range(from, to);

  if (filter.query) {
    query = query.or(
      `department_name.ilike.%${filter.query}%,university_name.ilike.%${filter.query}%`,
    );
  }
  if (filter.universityName) {
    query = query.eq("university_name", filter.universityName);
  }
  if (filter.majorClassification) {
    query = query.eq("major_classification", filter.majorClassification);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  return { data: data as UniversityDepartment[], count: count ?? 0 };
}

/** 학과 상세 (교육과정 포함) */
export async function findDepartmentById(
  departmentId: string,
): Promise<DepartmentWithCurriculum | null> {
  const supabase = await createSupabaseServerClient();

  const [deptRes, curriculumRes] = await Promise.all([
    supabase
      .from("university_departments")
      .select("*")
      .eq("id", departmentId)
      .single(),
    supabase
      .from("department_curriculum")
      .select("*")
      .eq("department_id", departmentId)
      .order("semester")
      .order("course_name"),
  ]);

  if (deptRes.error || !deptRes.data) return null;

  return {
    ...(deptRes.data as UniversityDepartment),
    curriculum: (curriculumRes.data as DepartmentCurriculum[]) ?? [],
  };
}

/** 대학별 학과 목록 */
export async function findDepartmentsByUniversity(
  universityName: string,
): Promise<UniversityDepartment[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("university_departments")
    .select("*")
    .eq("university_name", universityName)
    .order("department_name");

  if (error) throw error;
  return data as UniversityDepartment[];
}

// ============================================================
// 2. 사전 매핑 우회학과 페어
// ============================================================

/** 특정 학과의 사전 매핑된 우회학과 페어 목록 */
export async function findBypassPairs(
  departmentId: string,
): Promise<BypassMajorPair[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("bypass_major_pairs")
    .select("*")
    .eq("department_id", departmentId)
    .order("bypass_department_name");

  if (error) throw error;
  return data as BypassMajorPair[];
}

// ============================================================
// 3. 우회학과 후보 (학생별)
// ============================================================

/** 학생별 우회학과 후보 목록 (학과 상세 JOIN) */
export async function findCandidates(
  studentId: string,
  schoolYear: number,
): Promise<BypassCandidateWithDetails[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("bypass_major_candidates")
    .select(
      `*,
      target_department:university_departments!bypass_major_candidates_target_department_id_fkey(*),
      candidate_department:university_departments!bypass_major_candidates_candidate_department_id_fkey(*)`,
    )
    .eq("student_id", studentId)
    .eq("school_year", schoolYear)
    .order("composite_score", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data as BypassCandidateWithDetails[];
}

/** 후보 일괄 저장 (upsert — target+candidate+student 기준) */
export async function saveCandidates(
  candidates: Array<
    Omit<BypassMajorCandidate, "id" | "created_at" | "updated_at">
  >,
): Promise<void> {
  if (candidates.length === 0) return;

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("bypass_major_candidates").upsert(
    candidates.map((c) => ({
      tenant_id: c.tenant_id,
      student_id: c.student_id,
      target_department_id: c.target_department_id,
      candidate_department_id: c.candidate_department_id,
      source: c.source,
      curriculum_similarity_score: c.curriculum_similarity_score,
      placement_grade: c.placement_grade,
      competency_fit_score: c.competency_fit_score,
      composite_score: c.composite_score,
      rationale: c.rationale,
      consultant_notes: c.consultant_notes,
      status: c.status,
      school_year: c.school_year,
    })),
    {
      onConflict:
        "student_id,target_department_id,candidate_department_id,school_year",
    },
  );

  if (error) throw error;
}

/** 후보 상태 업데이트 */
export async function updateCandidateStatus(
  candidateId: string,
  status: BypassCandidateStatus,
  notes?: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const updates: Record<string, unknown> = { status };
  if (notes !== undefined) {
    updates.consultant_notes = notes;
  }

  const { error } = await supabase
    .from("bypass_major_candidates")
    .update(updates)
    .eq("id", candidateId);

  if (error) throw error;
}

/** 후보 메모만 업데이트 (상태 유지) */
export async function updateCandidateNotes(
  candidateId: string,
  notes: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("bypass_major_candidates")
    .update({ consultant_notes: notes })
    .eq("id", candidateId);

  if (error) throw error;
}

// ============================================================
// 4. 분류 코드 조회
// ============================================================

/** 전체 분류 코드 목록 */
export async function findClassifications(): Promise<
  DepartmentClassification[]
> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("department_classifications")
    .select("*")
    .order("major_code")
    .order("mid_code")
    .order("sub_code");

  if (error) throw error;
  return data as DepartmentClassification[];
}

// ============================================================
// 5. 교육과정 비교
// ============================================================

/** 동일 대분류 학과 목록 (후보 생성용) */
export async function findDepartmentsByMajorClassification(
  majorClassification: string,
  excludeId: string,
  limit = 200,
): Promise<UniversityDepartment[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("university_departments")
    .select("*")
    .eq("major_classification", majorClassification)
    .neq("id", excludeId)
    .order("university_name")
    .order("department_name")
    .limit(limit);

  if (error) throw error;
  return data as UniversityDepartment[];
}

/** 복수 학과 교육과정 일괄 조회 */
export async function fetchCurriculumBatch(
  departmentIds: string[],
): Promise<Map<string, string[]>> {
  if (departmentIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("department_curriculum")
    .select("department_id, course_name")
    .in("department_id", departmentIds);

  if (error) throw error;

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const existing = map.get(row.department_id);
    if (existing) {
      existing.push(row.course_name);
    } else {
      map.set(row.department_id, [row.course_name]);
    }
  }
  return map;
}

/** 복수 학과 교육과정 일괄 조회 (course_type 포함, 가중치 Jaccard용) */
export async function fetchCurriculumWithTypeBatch(
  departmentIds: string[],
): Promise<Map<string, CourseWithType[]>> {
  if (departmentIds.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("department_curriculum")
    .select("department_id, course_name, course_type")
    .in("department_id", departmentIds);

  if (error) throw error;

  const map = new Map<string, CourseWithType[]>();
  for (const row of data ?? []) {
    const entry: CourseWithType = {
      courseName: row.course_name,
      courseType: row.course_type,
    };
    const existing = map.get(row.department_id);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(row.department_id, [entry]);
    }
  }
  return map;
}

/** 이름으로 학과 조회 (대학명 + 학과명) */
export async function findDepartmentByName(
  universityName: string,
  departmentName: string,
): Promise<UniversityDepartment | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("university_departments")
    .select("*")
    .eq("university_name", universityName)
    .eq("department_name", departmentName)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as UniversityDepartment | null;
}

/** 두 학과의 교육과정 비교 */
export async function compareCurriculum(
  deptIdA: string,
  deptIdB: string,
): Promise<CurriculumCompareResult | null> {
  const supabase = await createSupabaseServerClient();

  // 학과 정보 + 교육과정 병렬 조회
  const [deptARes, deptBRes, currARes, currBRes] = await Promise.all([
    supabase
      .from("university_departments")
      .select("id, department_name, university_name")
      .eq("id", deptIdA)
      .single(),
    supabase
      .from("university_departments")
      .select("id, department_name, university_name")
      .eq("id", deptIdB)
      .single(),
    supabase
      .from("department_curriculum")
      .select("course_name")
      .eq("department_id", deptIdA),
    supabase
      .from("department_curriculum")
      .select("course_name")
      .eq("department_id", deptIdB),
  ]);

  if (deptARes.error || !deptARes.data) return null;
  if (deptBRes.error || !deptBRes.data) return null;

  const coursesA = (currARes.data ?? []).map((c) => c.course_name);
  const coursesB = (currBRes.data ?? []).map((c) => c.course_name);

  const similarity = calculateCurriculumSimilarity(coursesA, coursesB);

  return {
    departmentA: {
      id: deptARes.data.id,
      name: deptARes.data.department_name,
      universityName: deptARes.data.university_name,
    },
    departmentB: {
      id: deptBRes.data.id,
      name: deptBRes.data.department_name,
      universityName: deptBRes.data.university_name,
    },
    sharedCourses: similarity.sharedCourses,
    uniqueToA: similarity.uniqueToA,
    uniqueToB: similarity.uniqueToB,
    overlapScore: similarity.overlapScore,
    totalCoursesA: similarity.totalCoursesA,
    totalCoursesB: similarity.totalCoursesB,
  };
}

// ============================================================
// 6. 전과/복수전공 참조 정책
// ============================================================

/** 대학별 전과/복수전공 정책 조회 */
export async function findTransferPolicies(
  universityName: string,
  dataYear = 2026,
): Promise<UniversityTransferPolicy[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("university_transfer_policies")
    .select("*")
    .eq("university_name", universityName)
    .eq("data_year", dataYear)
    .order("policy_type");

  if (error) throw error;
  return data as UniversityTransferPolicy[];
}
