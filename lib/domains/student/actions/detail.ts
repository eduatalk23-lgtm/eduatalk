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

    // 4개 쿼리 병렬 실행 (students + user_profiles + parent_student_links + auth)
    const [studentResult, profileResult, linksResult, authUserResult] = await Promise.all([
      adminClient
        .from("students")
        .select(
          "id,grade,class,birth_date,school_id,school_name,school_type,division,memo,status,gender,address,emergency_contact,emergency_contact_phone,medical_info,exam_year,curriculum_revision,desired_university_ids,desired_career_field,target_school_tier,withdrawn_at,withdrawn_reason,withdrawn_memo"
        )
        .eq("id", studentId)
        .maybeSingle(),
      adminClient
        .from("user_profiles")
        .select("name, phone, is_active, profile_image_url")
        .eq("id", studentId)
        .maybeSingle(),
      adminClient
        .from("parent_student_links")
        .select("relation, parent:user_profiles!parent_student_links_parent_id_fkey(phone)")
        .eq("student_id", studentId),
      adminClient.auth.admin.getUserById(studentId),
    ]);

    if (studentResult.error || !studentResult.data) {
      return { success: false, error: "학생 정보를 찾을 수 없습니다." };
    }

    // 학부모 전화번호 추출
    let motherPhone: string | null = null;
    let fatherPhone: string | null = null;

    if (linksResult.data) {
      for (const link of linksResult.data) {
        const parentRaw = link.parent as unknown;
        const parent = Array.isArray(parentRaw) ? parentRaw[0] : parentRaw;
        const phone = (parent as { phone: string | null } | null)?.phone;
        if (!phone) continue;

        if (link.relation === "mother" && !motherPhone) {
          motherPhone = phone;
        } else if (link.relation === "father" && !fatherPhone) {
          fatherPhone = phone;
        }
      }
    }

    const student = { ...studentResult.data, ...profileResult.data };
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
        | "not_enrolled"
        | null,
      withdrawn_at: student.withdrawn_at ?? null,
      withdrawn_reason: student.withdrawn_reason ?? null,
      withdrawn_memo: student.withdrawn_memo ?? null,
      is_active: student.is_active ?? true,
      // profile
      gender: (student.gender as "남" | "여" | null) ?? null,
      phone: student.phone ?? null,
      mother_phone: motherPhone,
      father_phone: fatherPhone,
      address: student.address ?? null,
      emergency_contact: student.emergency_contact ?? null,
      emergency_contact_phone: student.emergency_contact_phone ?? null,
      medical_info: student.medical_info ?? null,
      // career
      exam_year: student.exam_year ?? null,
      curriculum_revision: student.curriculum_revision as
        | "2009 개정"
        | "2015 개정"
        | "2022 개정"
        | null,
      desired_university_ids: student.desired_university_ids ?? null,
      desired_career_field: student.desired_career_field ?? null,
      target_school_tier: student.target_school_tier ?? null,
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
