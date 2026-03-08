"use server";

/**
 * 학생 계정 연결 해제
 *
 * 연결된 학생의 students.id를 임시 UUID로 변경하여
 * auth user와의 연결을 끊습니다.
 * 학습 데이터는 FK CASCADE로 자동 보존됩니다.
 */

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError, logActionSuccess } from "@/lib/logging/actionLogger";
import { revalidatePath } from "next/cache";

export async function disconnectStudent(
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdminOrConsultant();

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return { success: false, error: "서버 오류가 발생했습니다." };
  }

  try {
    // 1) 연결된 auth user인지 확인
    const { data: authData } = await adminClient.auth.admin.getUserById(studentId);
    if (!authData?.user) {
      return { success: false, error: "연결된 계정이 없는 학생입니다." };
    }

    // 2) 새 임시 UUID 생성
    const newTempId = crypto.randomUUID();

    // 3) transfer_student_identity RPC로 students.id 변경
    //    FK ON UPDATE CASCADE가 모든 참조 테이블을 자동 업데이트
    const { error: rpcError } = await adminClient.rpc("transfer_student_identity", {
      old_id: studentId,
      new_id: newTempId,
    });

    if (rpcError) {
      logActionError(
        { domain: "student", action: "disconnect" },
        rpcError,
        { studentId }
      );
      return { success: false, error: "연결 해제에 실패했습니다. 다시 시도해주세요." };
    }

    // 4) 기존 accepted 학생 초대를 cancelled로 변경
    await adminClient
      .from("invitations")
      .update({ status: "cancelled" })
      .eq("student_id", newTempId) // CASCADE로 이미 newTempId로 변경됨
      .eq("target_role", "student")
      .eq("status", "accepted");

    // 5) auth user 메타데이터에서 student 역할 제거
    const currentMeta = authData.user.user_metadata ?? {};
    await adminClient.auth.admin.updateUserById(studentId, {
      user_metadata: {
        ...currentMeta,
        signup_role: null,
        student_disconnected: true,
        disconnected_at: new Date().toISOString(),
      },
    });

    // 6) 기존 세션 무효화 — 연결 해제된 계정으로 계속 접근 방지
    await adminClient.auth.admin.signOut(studentId, "global");

    // 7) 연결 이력 기록
    await adminClient.from("student_connection_history").insert({
      student_id: newTempId,
      auth_user_id: studentId,
      action: "disconnected",
      performed_by: auth.userId,
    });

    logActionSuccess(
      { domain: "student", action: "disconnect", userId: auth.userId },
      {
        studentId,
        newTempId,
        disconnectedEmail: authData.user.email,
      }
    );

    // 8) 캐시 무효화
    revalidatePath(`/admin/students/${newTempId}`);
    revalidatePath("/admin/students");

    return { success: true };
  } catch (error) {
    logActionError(
      { domain: "student", action: "disconnect" },
      error,
      { studentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "연결 해제 중 오류가 발생했습니다.",
    };
  }
}
