import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type StudentCareerGoal = {
  id: string;
  student_id: string;
  tenant_id?: string | null;
  exam_year?: number | null;
  curriculum_revision?: "2009 개정" | "2015 개정" | "2022 개정" | null;
  desired_university_ids?: string[] | null; // 희망 대학교 통합 ID 배열 (최대 3개, 형식: UNIV_14, SCHOOL_123 등)
  desired_career_field?: string | null;
  target_major?: string | null;
  target_major_2?: string | null;
  target_score?: Record<string, number> | null;
  target_university_type?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * 학생 ID로 진로 목표 정보 조회
 */
export async function getStudentCareerGoalById(
  studentId: string
): Promise<StudentCareerGoal | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_career_goals")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle<StudentCareerGoal>();

  if (error && error.code !== "PGRST116") {
    console.error("[data/studentCareerGoals] 진로 목표 조회 실패", error);
    return null;
  }

  return data ?? null;
}

/**
 * 진로 목표 정보 생성/업데이트
 */
export async function upsertStudentCareerGoal(
  goal: {
    student_id: string;
    tenant_id?: string | null;
    exam_year?: number | null;
    curriculum_revision?: "2009 개정" | "2015 개정" | "2022 개정" | null;
    desired_university_ids?: string[] | null; // 희망 대학교 통합 ID 배열 (최대 3개, 형식: UNIV_14, SCHOOL_123 등)
    desired_career_field?: string | null;
    target_major?: string | null;
    target_major_2?: string | null;
    target_score?: Record<string, number> | null;
    target_university_type?: string | null;
    notes?: string | null;
  }
): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createSupabaseServerClient();

  // 기존 레코드 확인
  const { data: existing } = await supabase
    .from("student_career_goals")
    .select("id")
    .eq("student_id", goal.student_id)
    .maybeSingle();

  // desired_university_ids 배열 검증 (최대 3개)
  let universityIds = goal.desired_university_ids ?? null;
  if (universityIds && universityIds.length > 3) {
    return {
      success: false,
      error: "희망 대학교는 최대 3개까지만 선택할 수 있습니다.",
    };
  }

  // null이나 빈 배열을 빈 배열로 정규화
  if (universityIds === null || universityIds.length === 0) {
    universityIds = [];
  }

  // desired_university_ids는 통합 ID 형식 (UNIV_14, SCHOOL_123 등)을 그대로 저장
  // 통합 ID 형식이 아닌 경우에만 변환 시도
  let resolvedUniversityIds: string[] = [];
  if (universityIds.length > 0) {
    // 통합 ID 형식인지 확인 (UNIV_14, SCHOOL_123 등)
    const unifiedIdRegex = /^(UNIV_|SCHOOL_)\d+$/;
    const isAllUnifiedIds = universityIds.every((id) => unifiedIdRegex.test(id));

    if (isAllUnifiedIds) {
      // 이미 통합 ID 형식이면 그대로 사용
      resolvedUniversityIds = universityIds;
    } else {
      // UUID 형식인지 확인 (8-4-4-4-12 형식)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isAllUuids = universityIds.every((id) => uuidRegex.test(id));

      if (isAllUuids) {
        // UUID가 전달된 경우, 경고 로그 출력 (향후 통합 ID로 마이그레이션 필요)
        console.warn(
          "[data/studentCareerGoals] UUID 형식의 desired_university_ids가 전달되었습니다. 통합 ID 형식 (UNIV_*, SCHOOL_*)을 사용해주세요."
        );
        resolvedUniversityIds = universityIds;
      } else {
        // 알 수 없는 형식
        console.error(
          "[data/studentCareerGoals] 알 수 없는 desired_university_ids 형식:",
          universityIds
        );
        return {
          success: false,
          error: "학교 ID 형식이 올바르지 않습니다. 통합 ID 형식 (UNIV_*, SCHOOL_*)을 사용해주세요.",
        };
      }
    }
  }

  const payload = {
    student_id: goal.student_id,
    tenant_id: goal.tenant_id ?? null,
    exam_year: goal.exam_year ?? null,
    curriculum_revision: goal.curriculum_revision ?? null,
    desired_university_ids: resolvedUniversityIds,
    desired_career_field: goal.desired_career_field ?? null,
    target_major: goal.target_major ?? null,
    target_major_2: goal.target_major_2 ?? null,
    target_score: goal.target_score ?? null,
    target_university_type: goal.target_university_type ?? null,
    notes: goal.notes ?? null,
  };

  let result;
  if (existing) {
    // 업데이트
    result = await supabase
      .from("student_career_goals")
      .update(payload)
      .eq("student_id", goal.student_id)
      .select("id")
      .single();
  } else {
    // 생성
    result = await supabase
      .from("student_career_goals")
      .insert(payload)
      .select("id")
      .single();
  }

  if (result.error) {
    console.error("[data/studentCareerGoals] 진로 목표 저장 실패", result.error);
    return { success: false, error: result.error.message };
  }

  return { success: true, id: result.data?.id };
}

