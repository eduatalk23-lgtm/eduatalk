"use server";

// ============================================
// Phase 6: 워크플로우 확정 액션
// AI→컨설턴트 수용 + 컨설턴트→확정 흐름
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "student-record", action: "confirm" };

// ── 1. 가이드 배정 확정 ──

/** 가이드 배정을 확정 (confirmed_at/by 설정) */
export async function confirmAssignmentAction(
  assignmentId: string,
): Promise<ActionResponse> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("exploration_guide_assignments")
      .update({
        status: "completed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: userId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", assignmentId);

    if (error) throw error;
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "confirmAssignment" }, error, { assignmentId });
    return createErrorResponse("배정 확정에 실패했습니다.");
  }
}

// ── 2. 가안 확정 ──

/** AI 초안 → 컨설턴트 가안으로 수용 (ai_draft_content → content 복사) */
export async function acceptAiDraftAction(
  recordId: string,
  recordType: "setek" | "changche" | "haengteuk" | "personal_setek",
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();
    const table = TABLE_MAP[recordType];

    // AI 초안 조회
    const { data, error: fetchErr } = await supabase
      .from(table)
      .select("ai_draft_content")
      .eq("id", recordId)
      .single();
    if (fetchErr) throw fetchErr;

    if (!data?.ai_draft_content) {
      return createErrorResponse("AI 초안이 없습니다.");
    }

    // content에 복사
    const { error } = await supabase
      .from(table)
      .update({ content: data.ai_draft_content })
      .eq("id", recordId);
    if (error) throw error;

    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "acceptAiDraft" }, error, { recordId, recordType });
    return createErrorResponse("AI 초안 수용에 실패했습니다.");
  }
}

/** 컨설턴트 가안 → 확정본으로 확정 (content → confirmed_content 복사) */
export async function confirmDraftAction(
  recordId: string,
  recordType: "setek" | "changche" | "haengteuk" | "personal_setek",
): Promise<ActionResponse> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();
    const table = TABLE_MAP[recordType];

    // 현재 content 조회
    const { data, error: fetchErr } = await supabase
      .from(table)
      .select("content")
      .eq("id", recordId)
      .single();
    if (fetchErr) throw fetchErr;

    if (!data?.content) {
      return createErrorResponse("확정할 가안이 없습니다.");
    }

    const { error } = await supabase
      .from(table)
      .update({
        confirmed_content: data.content,
        confirmed_at: new Date().toISOString(),
        confirmed_by: userId,
      })
      .eq("id", recordId);
    if (error) throw error;

    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "confirmDraft" }, error, { recordId, recordType });
    return createErrorResponse("가안 확정에 실패했습니다.");
  }
}

// ── 3. 분석 태그 확정 ──

/** 분석 태그 상태를 confirmed로 변경 */
export async function confirmTagsAction(
  tagIds: string[],
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("student_record_activity_tags")
      .update({ status: "confirmed" })
      .in("id", tagIds);
    if (error) throw error;

    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "confirmTags" }, error, { tagIds });
    return createErrorResponse("태그 확정에 실패했습니다.");
  }
}

// ── 4. 방향 가이드 확정 ──

/** 세특 방향 가이드 확정 (status → confirmed, confirmed_at/by 설정) */
export async function confirmDirectionAction(
  guideId: string,
): Promise<ActionResponse> {
  try {
    const { userId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("student_record_setek_guides")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: userId,
      })
      .eq("id", guideId);
    if (error) throw error;

    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "confirmDirection" }, error, { guideId });
    return createErrorResponse("방향 가이드 확정에 실패했습니다.");
  }
}

// ── 테이블 매핑 ──

const TABLE_MAP = {
  setek: "student_record_seteks",
  changche: "student_record_changche",
  haengteuk: "student_record_haengteuk",
  personal_setek: "student_record_personal_seteks",
} as const;
