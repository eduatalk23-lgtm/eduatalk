"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 비밀번호 변경
 */
export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  // 현재 비밀번호 확인
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });

  if (signInError) {
    return { success: false, error: "현재 비밀번호가 올바르지 않습니다." };
  }

  // 새 비밀번호로 변경
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    console.error("[actions/accountActions] 비밀번호 변경 실패:", updateError);
    return { success: false, error: updateError.message };
  }

  return { success: true };
}

