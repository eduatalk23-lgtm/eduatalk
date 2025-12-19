"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrConsultant } from "@/lib/auth/guards";

/**
 * 관리자 계정 생성
 */
export async function createAdminUser(formData: FormData) {
  // 권한 확인 (admin만 허용)
  const { role: currentRole } = await requireAdminOrConsultant();

  // Super Admin만 접근 가능
  if (currentRole !== "admin" && currentRole !== "superadmin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const userEmail = formData.get("user_email")?.toString();
  const userRole = formData.get("role")?.toString() as "admin" | "consultant";

  if (!userEmail || !userRole) {
    throw new Error("이메일과 역할을 입력해주세요.");
  }

  if (userRole !== "admin" && userRole !== "consultant") {
    throw new Error("올바른 역할을 선택해주세요.");
  }

  const supabase = await createSupabaseServerClient();

  // 이메일로 사용자 조회 (Service Role Key 필요)
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다."
    );
  }

  const { data: users, error: listError } =
    await adminClient.auth.admin.listUsers();

  if (listError) {
    console.error("[admin-users] 사용자 목록 조회 실패:", listError);
    throw new Error("사용자 목록을 조회할 수 없습니다.");
  }

  const user = users.users.find(
    (u: { email?: string }) => u.email === userEmail
  );

  if (!user) {
    throw new Error("해당 이메일의 사용자를 찾을 수 없습니다.");
  }

  // 이미 관리자인지 확인
  const { data: existingAdmin } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingAdmin) {
    throw new Error("이미 관리자로 등록된 사용자입니다.");
  }

  // admin_users에 추가
  const { error: insertError } = await supabase.from("admin_users").insert({
    id: user.id,
    role: userRole,
  });

  if (insertError) {
    console.error("[admin-users] 관리자 계정 생성 실패:", insertError);
    throw new Error(insertError.message || "관리자 계정 생성에 실패했습니다.");
  }
}

/**
 * 관리자 권한 제거
 */
export async function deleteAdminUser(userId: string) {
  // 권한 확인 (admin만 허용)
  const { role: currentRole, userId: currentUserId } =
    await requireAdminOrConsultant();

  // Super Admin만 접근 가능
  if (currentRole !== "admin" && currentRole !== "superadmin") {
    throw new Error("관리자 권한이 필요합니다.");
  }

  // 자신의 권한은 제거할 수 없음
  if (currentUserId === userId) {
    throw new Error("자신의 관리자 권한은 제거할 수 없습니다.");
  }

  const supabase = await createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from("admin_users")
    .delete()
    .eq("id", userId);

  if (deleteError) {
    console.error("[admin-users] 관리자 권한 제거 실패:", deleteError);
    throw new Error(deleteError.message || "관리자 권한 제거에 실패했습니다.");
  }
}
