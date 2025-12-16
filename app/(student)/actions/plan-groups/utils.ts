/**
 * plan_purpose 값을 그대로 저장 (변환 없음)
 * "내신대비", "모의고사(수능)" 그대로 저장
 */
export function normalizePlanPurpose(
  purpose: string | null | undefined
): string | null {
  if (!purpose) return null;
  // 기존 데이터 호환성: "수능" 또는 "모의고사"는 "모의고사(수능)"으로 변환
  if (purpose === "수능" || purpose === "모의고사") return "모의고사(수능)";
  return purpose;
}

import { timeToMinutes } from "@/lib/utils/time";

/**
 * 기존 draft 플랜 그룹 확인
 * 중복 생성 방지를 위해 동일한 조건의 draft가 있는지 확인
 */
export async function findExistingDraftPlanGroup(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  studentId: string,
  name: string | null,
  campInvitationId?: string | null
): Promise<{ id: string; status: string } | null> {
  let query = supabase
    .from("plan_groups")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("status", "draft")
    .is("deleted_at", null);

  // 이름이 있으면 이름으로도 필터링
  if (name) {
    query = query.eq("name", name);
  }

  // camp_invitation_id가 있으면 그것도 확인
  if (campInvitationId) {
    query = query.eq("camp_invitation_id", campInvitationId);
  }

  const { data: existingGroup, error: checkError } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    // PGRST116은 "multiple rows" 에러인데, 이는 이미 처리됨 (limit(1) 사용)
    console.error("[findExistingDraftPlanGroup] 기존 플랜 그룹 확인 중 에러:", checkError);
    // 에러가 있어도 null 반환 (새로 생성 시도)
    return null;
  }

  return existingGroup && existingGroup.status === "draft" ? existingGroup : null;
}

