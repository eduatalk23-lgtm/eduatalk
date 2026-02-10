"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError, logActionSuccess } from "@/lib/logging/actionLogger";
import { revalidatePath } from "next/cache";
import type { InviteCode, InviteTargetRole, InviteRelation } from "./types";

// ============================================
// Internal Helpers
// ============================================

function generateInviteCodeString(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  const getRandomChar = () => {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const index = randomArray[0] % chars.length;
    return chars[index];
  };

  const part1 = Array.from({ length: 4 }, getRandomChar).join("");
  const part2 = Array.from({ length: 4 }, getRandomChar).join("");

  return `INV-${part1}-${part2}`;
}

async function generateUniqueInviteCode(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  maxRetries = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateInviteCodeString();

    const { data, error } = await supabase
      .from("invite_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      logActionError(
        { domain: "invite", action: "generateUniqueInviteCode" },
        error,
        { code, attempt }
      );
      throw new Error("초대 코드 생성 중 오류가 발생했습니다.");
    }

    if (!data) {
      return code;
    }
  }

  throw new Error("고유한 초대 코드를 생성할 수 없습니다. 다시 시도해주세요.");
}

// ============================================
// Public Actions
// ============================================

/**
 * 초대 코드 생성
 */
export async function createInviteCode(input: {
  studentId: string;
  targetRole: InviteTargetRole;
  relation?: InviteRelation | null;
}): Promise<{
  success: boolean;
  code?: string;
  data?: InviteCode;
  error?: string;
}> {
  const { tenantId, userId } = await requireAdminOrConsultant();

  if (!userId) {
    return { success: false, error: "사용자 정보를 찾을 수 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const code = await generateUniqueInviteCode(supabase);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30일 후 만료

    const { data: row, error } = await supabase
      .from("invite_codes")
      .insert({
        code,
        student_id: input.studentId,
        target_role: input.targetRole,
        relation: input.relation ?? null,
        expires_at: expiresAt.toISOString(),
        created_by: userId,
        tenant_id: tenantId ?? null,
      })
      .select("id, code, student_id, target_role, relation, expires_at, used_at, created_at")
      .single();

    if (error || !row) {
      logActionError(
        { domain: "invite", action: "createInviteCode" },
        error,
        { studentId: input.studentId }
      );
      return { success: false, error: `초대 코드 생성에 실패했습니다: ${error?.message}` };
    }

    const inviteCode: InviteCode = {
      id: row.id,
      code: row.code,
      studentId: row.student_id,
      studentName: null,
      targetRole: row.target_role as InviteTargetRole,
      relation: row.relation as InviteRelation | null,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      createdAt: row.created_at,
    };

    revalidatePath(`/admin/students/${input.studentId}`);
    return { success: true, code, data: inviteCode };
  } catch (error) {
    logActionError(
      { domain: "invite", action: "createInviteCode" },
      error,
      { studentId: input.studentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "초대 코드 생성 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 학생별 초대 코드 목록 조회
 */
export async function getStudentInviteCodes(
  studentId: string
): Promise<{ success: boolean; data?: InviteCode[]; error?: string }> {
  await requireAdminOrConsultant();

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("invite_codes")
    .select(
      `
      id,
      code,
      student_id,
      target_role,
      relation,
      expires_at,
      used_at,
      created_at,
      students:student_id(name)
    `
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) {
    logActionError(
      { domain: "invite", action: "getStudentInviteCodes" },
      error,
      { studentId }
    );
    return { success: false, error: error.message };
  }

  const codes: InviteCode[] = (data ?? []).map((row) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    return {
      id: row.id,
      code: row.code,
      studentId: row.student_id,
      studentName: student?.name ?? null,
      targetRole: row.target_role as InviteCode["targetRole"],
      relation: row.relation as InviteCode["relation"],
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      createdAt: row.created_at,
    };
  });

  return { success: true, data: codes };
}

/**
 * 초대 코드 취소 (삭제)
 */
export async function revokeInviteCode(
  codeId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdminOrConsultant();

  const supabase = await createSupabaseServerClient();

  // 먼저 코드 정보 조회 (revalidatePath용)
  const { data: code } = await supabase
    .from("invite_codes")
    .select("student_id")
    .eq("id", codeId)
    .maybeSingle();

  const { error } = await supabase
    .from("invite_codes")
    .delete()
    .eq("id", codeId);

  if (error) {
    logActionError(
      { domain: "invite", action: "revokeInviteCode" },
      error,
      { codeId }
    );
    return { success: false, error: error.message };
  }

  if (code?.student_id) {
    revalidatePath(`/admin/students/${code.student_id}`);
  }

  return { success: true };
}

/**
 * 초대 코드 유효성 검증 (회원가입 시)
 */
export async function validateInviteCode(
  code: string
): Promise<{
  success: boolean;
  studentId?: string;
  targetRole?: InviteTargetRole;
  relation?: InviteRelation | null;
  error?: string;
}> {
  // 코드 형식 검증
  if (!code.match(/^INV-[A-Z0-9]{4}-[A-Z0-9]{4}$/)) {
    return { success: false, error: "초대 코드 형식이 올바르지 않습니다." };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("invite_codes")
    .select("student_id, target_role, relation, expires_at, used_at")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error) {
    logActionError(
      { domain: "invite", action: "validateInviteCode" },
      error,
      { code }
    );
    return { success: false, error: "초대 코드를 확인할 수 없습니다." };
  }

  if (!data) {
    return { success: false, error: "유효하지 않은 초대 코드입니다." };
  }

  if (new Date(data.expires_at) < new Date()) {
    return { success: false, error: "만료된 초대 코드입니다." };
  }

  if (data.used_at) {
    return { success: false, error: "이미 사용된 초대 코드입니다." };
  }

  return {
    success: true,
    studentId: data.student_id,
    targetRole: data.target_role as InviteTargetRole,
    relation: data.relation as InviteRelation | null,
  };
}

/**
 * 초대 코드 사용 처리 + parent_student_links 자동 생성
 */
export async function useInviteCode(
  code: string,
  userId: string,
  relation?: string
): Promise<{ success: boolean; studentId?: string; error?: string }> {
  const adminResult = createSupabaseAdminClient();
  if (!adminResult) {
    return { success: false, error: "서버 설정 오류입니다." };
  }
  const supabase = adminResult;

  try {
    // 1. 코드 조회 및 검증
    const { data: codeData, error: codeError } = await supabase
      .from("invite_codes")
      .select("id, student_id, target_role, relation, expires_at, used_at, tenant_id")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (codeError) {
      logActionError(
        { domain: "invite", action: "useInviteCode" },
        codeError,
        { code, userId }
      );
      return { success: false, error: "초대 코드 확인 중 오류가 발생했습니다." };
    }

    if (!codeData) {
      return { success: false, error: "유효하지 않은 초대 코드입니다." };
    }

    if (new Date(codeData.expires_at) < new Date()) {
      return { success: false, error: "만료된 초대 코드입니다." };
    }

    if (codeData.used_at) {
      return { success: false, error: "이미 사용된 초대 코드입니다." };
    }

    // 2. 코드 사용 처리
    const { error: updateError } = await supabase
      .from("invite_codes")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("id", codeData.id);

    if (updateError) {
      logActionError(
        { domain: "invite", action: "useInviteCode" },
        updateError,
        { code, userId }
      );
      return { success: false, error: "초대 코드 사용 처리에 실패했습니다." };
    }

    // 3. parent 타입이면 parent_student_links 자동 생성
    if (codeData.target_role === "parent") {
      const finalRelation = relation || codeData.relation || "guardian";

      if (!codeData.tenant_id) {
        return { success: false, error: "기관 정보가 없는 초대 코드입니다." };
      }

      // 중복 체크
      const { data: existingLink } = await supabase
        .from("parent_student_links")
        .select("id")
        .eq("parent_id", userId)
        .eq("student_id", codeData.student_id)
        .maybeSingle();

      if (!existingLink) {
        const { error: linkError } = await supabase
          .from("parent_student_links")
          .insert({
            parent_id: userId,
            student_id: codeData.student_id,
            relation: finalRelation,
            tenant_id: codeData.tenant_id,
          });

        if (linkError) {
          logActionError(
            { domain: "invite", action: "useInviteCode" },
            linkError,
            { code, userId, studentId: codeData.student_id }
          );
          return { success: false, error: "자녀 연결에 실패했습니다." };
        }
      }
    }

    logActionSuccess(
      { domain: "invite", action: "useInviteCode", userId },
      { code, studentId: codeData.student_id, targetRole: codeData.target_role }
    );

    return { success: true, studentId: codeData.student_id };
  } catch (error) {
    logActionError(
      { domain: "invite", action: "useInviteCode" },
      error,
      { code, userId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "초대 코드 사용 중 오류가 발생했습니다.",
    };
  }
}
