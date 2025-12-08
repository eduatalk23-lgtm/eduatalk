"use server";

import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * 학생 계정 비활성화/활성화
 */
export async function toggleStudentStatus(
  studentId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("students")
    .update({ is_active: isActive })
    .eq("id", studentId);

  if (error) {
    console.error("[admin/studentManagement] 학생 상태 변경 실패", error);
    return { success: false, error: error.message || "상태 변경에 실패했습니다." };
  }

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);

  return { success: true };
}

/**
 * 학생 계정 삭제 (소프트 삭제: is_active를 false로 설정하고 auth.users에서도 삭제)
 */
export async function deleteStudent(
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin") {
    return { success: false, error: "관리자만 학생을 삭제할 수 있습니다." };
  }

  const supabase = await createSupabaseServerClient();

  // 1. students 테이블에서 is_active를 false로 설정 (소프트 삭제)
  const { error: updateError } = await supabase
    .from("students")
    .update({ is_active: false })
    .eq("id", studentId);

  if (updateError) {
    console.error("[admin/studentManagement] 학생 비활성화 실패", updateError);
    return { success: false, error: updateError.message || "학생 삭제에 실패했습니다." };
  }

  // 2. auth.users에서도 삭제 (관리자 권한 필요)
  try {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(studentId);
    if (deleteError) {
      console.error("[admin/studentManagement] 인증 사용자 삭제 실패", deleteError);
      // 인증 사용자 삭제 실패해도 students 테이블은 업데이트되었으므로 경고만
      console.warn("[admin/studentManagement] 인증 사용자 삭제 실패했지만 학생 정보는 비활성화되었습니다.");
    }
  } catch (error) {
    console.error("[admin/studentManagement] 인증 사용자 삭제 중 오류", error);
    // 인증 사용자 삭제 실패해도 students 테이블은 업데이트되었으므로 경고만
  }

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);

  return { success: true };
}

/**
 * 학생 반 정보 업데이트 (관리자 전용)
 */
export async function updateStudentClass(
  studentId: string,
  classValue: string | null
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getCurrentUserRole();

  if (role !== "admin" && role !== "consultant") {
    return { success: false, error: "권한이 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  // 빈 문자열을 null로 변환
  const normalizedClass = classValue?.trim() || null;

  const { error } = await supabase
    .from("students")
    .update({ class: normalizedClass })
    .eq("id", studentId);

  if (error) {
    console.error("[admin/studentManagement] 학생 반 정보 변경 실패", error);
    return { success: false, error: error.message || "반 정보 변경에 실패했습니다." };
  }

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);

  return { success: true };
}

