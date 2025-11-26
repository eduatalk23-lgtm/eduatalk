import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type StudentCareerGoal = {
  id: string;
  student_id: string;
  tenant_id?: string | null;
  exam_year?: number | null;
  curriculum_revision?: "2009 개정" | "2015 개정" | "2022 개정" | null;
  desired_university_ids?: string[] | null; // 희망 대학교 ID 배열 (최대 3개)
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
    desired_university_ids?: string[] | null; // 희망 대학교 ID 배열 (최대 3개)
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

  const payload = {
    student_id: goal.student_id,
    tenant_id: goal.tenant_id ?? null,
    exam_year: goal.exam_year ?? null,
    curriculum_revision: goal.curriculum_revision ?? null,
    desired_university_ids: universityIds,
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

