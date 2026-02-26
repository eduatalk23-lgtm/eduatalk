"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StudentInfoData } from "@/app/(admin)/admin/students/[id]/_types/studentFormTypes";
import { extractPrimaryProvider } from "@/lib/utils/authProvider";

export type StudentDetailResult = {
  success: boolean;
  data?: StudentInfoData & {
    email: string | null;
    authProvider: string;
    lastSignInAt: string | null;
  };
  error?: string;
};

/**
 * 학생 상세 조회 서버 액션 (통합 관리 화면용)
 * students 단일 테이블 + auth email 조회 (2개 쿼리)
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

    // 2개 쿼리 병렬 실행 (students + auth)
    const [studentResult, authUserResult] = await Promise.all([
      adminClient
        .from("students")
        .select(
          "id,name,grade,class,birth_date,school_id,school_name,school_type,division,memo,status,is_active,gender,phone,mother_phone,father_phone,address,emergency_contact,emergency_contact_phone,medical_info,exam_year,curriculum_revision,desired_university_ids,desired_career_field"
        )
        .eq("id", studentId)
        .maybeSingle(),
      adminClient.auth.admin.getUserById(studentId),
    ]);

    if (studentResult.error || !studentResult.data) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    const student = studentResult.data;
    const authUser = authUserResult.data?.user;
    const email = authUser?.email ?? null;
    const authProvider = extractPrimaryProvider(authUser?.identities);
    const lastSignInAt = authUser?.last_sign_in_at ?? null;

    const studentInfoData: StudentInfoData & {
      email: string | null;
      authProvider: string;
      lastSignInAt: string | null;
    } = {
      id: student.id,
      name: student.name,
      grade: student.grade != null ? String(student.grade) : null,
      class: student.class,
      birth_date: student.birth_date,
      school_id: student.school_id,
      school_name: student.school_name,
      school_type: student.school_type as
        | "MIDDLE"
        | "HIGH"
        | "UNIVERSITY"
        | null,
      division: student.division as "고등부" | "중등부" | "졸업" | null,
      memo: student.memo ?? null,
      status: student.status as
        | "enrolled"
        | "on_leave"
        | "graduated"
        | "transferred"
        | null,
      is_active: student.is_active ?? true,
      // profile (now in students table)
      gender: (student.gender as "남" | "여" | null) ?? null,
      phone: student.phone ?? null,
      mother_phone: student.mother_phone ?? null,
      father_phone: student.father_phone ?? null,
      address: student.address ?? null,
      emergency_contact: student.emergency_contact ?? null,
      emergency_contact_phone: student.emergency_contact_phone ?? null,
      medical_info: student.medical_info ?? null,
      // career (now in students table)
      exam_year: student.exam_year ?? null,
      curriculum_revision: student.curriculum_revision as
        | "2009 개정"
        | "2015 개정"
        | "2022 개정"
        | null,
      desired_university_ids: student.desired_university_ids ?? null,
      desired_career_field: student.desired_career_field ?? null,
      // auth
      email,
      authProvider,
      lastSignInAt,
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
