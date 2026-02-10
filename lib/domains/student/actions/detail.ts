"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StudentInfoData } from "@/app/(admin)/admin/students/[id]/_types/studentFormTypes";

export type StudentDetailResult = {
  success: boolean;
  data?: StudentInfoData & { email: string | null };
  error?: string;
};

/**
 * 학생 상세 조회 서버 액션 (통합 관리 화면용)
 * students + student_profiles + student_career_goals + auth email 조회
 */
export async function getStudentDetailAction(
  studentId: string
): Promise<StudentDetailResult> {
  try {
    await requireAdminOrConsultant();

    const supabase = await createSupabaseServerClient();
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    // 4개 쿼리 병렬 실행 (이메일은 getUserById로 단건 조회)
    const [studentResult, profileResult, careerGoalResult, authUserResult] =
      await Promise.all([
        supabase
          .from("students")
          .select(
            "id,name,grade,class,birth_date,school_id,school_name,school_type,division,memo,status,is_active,created_at,updated_at"
          )
          .eq("id", studentId)
          .maybeSingle(),
        adminClient
          .from("student_profiles")
          .select("*")
          .eq("id", studentId)
          .maybeSingle(),
        adminClient
          .from("student_career_goals")
          .select("*")
          .eq("student_id", studentId)
          .maybeSingle(),
        adminClient.auth.admin.getUserById(studentId),
      ]);

    if (studentResult.error || !studentResult.data) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    const student = studentResult.data;
    const profile = profileResult.data;
    const careerGoal = careerGoalResult.data;
    const email = authUserResult.data?.user?.email ?? null;

    const studentInfoData: StudentInfoData & { email: string | null } = {
      id: student.id,
      name: student.name,
      grade: student.grade,
      class: student.class,
      birth_date: student.birth_date,
      school_id: student.school_id,
      school_name: student.school_name,
      school_type: student.school_type as
        | "MIDDLE"
        | "HIGH"
        | "UNIVERSITY"
        | null,
      division: student.division as "고등부" | "중등부" | "기타" | null,
      memo: student.memo ?? null,
      status: student.status as
        | "enrolled"
        | "on_leave"
        | "graduated"
        | "transferred"
        | null,
      is_active: student.is_active ?? true,
      // profile
      gender: (profile?.gender as "남" | "여" | null) ?? null,
      phone: profile?.phone ?? null,
      mother_phone: profile?.mother_phone ?? null,
      father_phone: profile?.father_phone ?? null,
      address: profile?.address ?? null,
      emergency_contact: profile?.emergency_contact ?? null,
      emergency_contact_phone: profile?.emergency_contact_phone ?? null,
      medical_info: profile?.medical_info ?? null,
      // career
      exam_year: careerGoal?.exam_year ?? null,
      curriculum_revision: careerGoal?.curriculum_revision as
        | "2009 개정"
        | "2015 개정"
        | "2022 개정"
        | null,
      desired_university_ids: careerGoal?.desired_university_ids ?? null,
      desired_career_field: careerGoal?.desired_career_field ?? null,
      // email
      email,
    };

    return { success: true, data: studentInfoData };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "학생 정보 조회 중 오류가 발생했습니다.",
    };
  }
}
