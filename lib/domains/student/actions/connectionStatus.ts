"use server";

/**
 * 학생 계정 연결 상태 조회
 *
 * 학생이 auth user와 연결되었는지, 대기 중인 초대가 있는지 판별합니다.
 * students.id === auth.users.id 이면 연결된 상태입니다.
 */

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// Types
// ============================================

export type StudentConnectionStatus =
  | {
      status: "connected";
      email: string;
      provider: string;
      connectedAt: string;
    }
  | {
      status: "pending";
      invitation: {
        id: string;
        token: string;
        deliveryMethod: string;
        deliveryStatus: string;
        phone: string | null;
        email: string | null;
        expiresAt: string;
        createdAt: string;
      };
    }
  | { status: "disconnected" };

// ============================================
// Action
// ============================================

export async function getStudentConnectionStatus(
  studentId: string
): Promise<StudentConnectionStatus> {
  await requireAdminOrConsultant();

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    logActionError(
      { domain: "student", action: "getStudentConnectionStatus" },
      new Error("Admin client initialization failed"),
      { studentId }
    );
    return { status: "disconnected" };
  }

  // 1) auth.users에서 studentId로 조회 → 있으면 connected
  const { data: authData } = await adminClient.auth.admin.getUserById(studentId);

  if (authData?.user) {
    const user = authData.user;
    const provider =
      user.app_metadata?.provider ??
      user.app_metadata?.providers?.[0] ??
      "email";

    return {
      status: "connected",
      email: user.email ?? "",
      provider,
      connectedAt: user.created_at,
    };
  }

  // 2) pending 학생 초대 조회
  const supabase = await createSupabaseServerClient();
  const { data: pendingInv } = await supabase
    .from("invitations")
    .select("id, token, delivery_method, delivery_status, phone, email, expires_at, created_at")
    .eq("student_id", studentId)
    .eq("target_role", "student")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingInv) {
    return {
      status: "pending",
      invitation: {
        id: pendingInv.id,
        token: pendingInv.token,
        deliveryMethod: pendingInv.delivery_method,
        deliveryStatus: pendingInv.delivery_status,
        phone: pendingInv.phone,
        email: pendingInv.email,
        expiresAt: pendingInv.expires_at,
        createdAt: pendingInv.created_at,
      },
    };
  }

  // 3) 둘 다 아니면 disconnected
  return { status: "disconnected" };
}
