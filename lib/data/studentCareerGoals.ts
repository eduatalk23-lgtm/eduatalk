/**
 * Student Career Goals 데이터 접근 레이어
 *
 * student_career_goals 테이블이 students로 통합되었으므로
 * 모든 함수가 students 테이블을 직접 조회/수정합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StudentCareerGoal = {
  id: string;
  student_id: string;
  tenant_id?: string | null;
  exam_year?: number | null;
  curriculum_revision?: "2009 개정" | "2015 개정" | "2022 개정" | null;
  desired_university_ids?: string[] | null;
  desired_career_field?: string | null;
  target_major?: string | null;
  target_major_2?: string | null;
  target_score?: Record<string, number> | null;
  target_university_type?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const CAREER_FIELDS =
  "id,tenant_id,exam_year,curriculum_revision,desired_university_ids,desired_career_field,target_major,target_major_2,target_score,target_university_type,career_notes,created_at,updated_at";

/**
 * 학생 ID로 진로 목표 정보 조회 (students 테이블에서 직접 조회)
 */
export async function getStudentCareerGoalById(
  studentId: string
): Promise<StudentCareerGoal | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("students")
    .select(CAREER_FIELDS)
    .eq("id", studentId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("[data/studentCareerGoals] 진로 목표 조회 실패", error);
    return null;
  }

  if (!data) return null;

  // students 테이블 데이터를 기존 StudentCareerGoal 형태로 매핑
  return {
    id: data.id,
    student_id: data.id,
    tenant_id: data.tenant_id,
    exam_year: data.exam_year as number | null,
    curriculum_revision: data.curriculum_revision as StudentCareerGoal["curriculum_revision"],
    desired_university_ids: data.desired_university_ids as string[] | null,
    desired_career_field: data.desired_career_field as string | null,
    target_major: data.target_major as string | null,
    target_major_2: data.target_major_2 as string | null,
    target_score: data.target_score as Record<string, number> | null,
    target_university_type: data.target_university_type as string | null,
    notes: data.career_notes as string | null,
    created_at: data.created_at as string | null,
    updated_at: data.updated_at as string | null,
  };
}

/**
 * 진로 목표 정보 업데이트 (students 테이블 직접 UPDATE)
 */
export async function upsertStudentCareerGoal(
  goal: {
    student_id: string;
    tenant_id?: string | null;
    exam_year?: number | null;
    curriculum_revision?: "2009 개정" | "2015 개정" | "2022 개정" | null;
    desired_university_ids?: string[] | null;
    desired_career_field?: string | null;
    target_major?: string | null;
    target_major_2?: string | null;
    target_score?: Record<string, number> | null;
    target_university_type?: string | null;
    notes?: string | null;
  }
): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createSupabaseServerClient();

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

  // 통합 ID 형식 검증
  let resolvedUniversityIds: string[] = [];
  if (universityIds.length > 0) {
    const unifiedIdRegex = /^(UNIV_|SCHOOL_)\d+$/;
    const isAllUnifiedIds = universityIds.every((id) => unifiedIdRegex.test(id));

    if (isAllUnifiedIds) {
      resolvedUniversityIds = universityIds;
    } else {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isAllUuids = universityIds.every((id) => uuidRegex.test(id));

      if (isAllUuids) {
        console.warn(
          "[data/studentCareerGoals] UUID 형식의 desired_university_ids가 전달되었습니다. 통합 ID 형식 (UNIV_*, SCHOOL_*)을 사용해주세요."
        );
        resolvedUniversityIds = universityIds;
      } else {
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

  // students 테이블 직접 UPDATE (career_notes로 매핑)
  const payload: Record<string, unknown> = {
    exam_year: goal.exam_year ?? null,
    curriculum_revision: goal.curriculum_revision ?? null,
    desired_university_ids: resolvedUniversityIds,
    desired_career_field: goal.desired_career_field ?? null,
    target_major: goal.target_major ?? null,
    target_major_2: goal.target_major_2 ?? null,
    target_score: goal.target_score ?? null,
    target_university_type: goal.target_university_type ?? null,
    career_notes: goal.notes ?? null,
  };

  const { error } = await supabase
    .from("students")
    .update(payload)
    .eq("id", goal.student_id);

  if (error) {
    console.error("[data/studentCareerGoals] 진로 목표 저장 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true, id: goal.student_id };
}
