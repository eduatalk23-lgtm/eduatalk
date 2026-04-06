"use server";

// ============================================
// Phase 6: 워크플로우 확정 액션
// AI→컨설턴트 수용 + 컨설턴트→확정 흐름
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
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

/** AI 초안 → 컨설턴트 가안으로 수용 (ai_draft_content → content 복사)
 *
 * @param force  true 이면 기존 content 가 있어도 덮어씀.
 *               false(기본) 이면 기존 content 가 있을 때 CONTENT_EXISTS 에러를 반환하여
 *               클라이언트가 확인 다이얼로그를 표시하도록 유도.
 */
export async function acceptAiDraftAction(
  recordId: string,
  recordType: "setek" | "changche" | "haengteuk" | "personal_setek",
  force?: boolean,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();
    const table = TABLE_MAP[recordType];

    // AI 초안 + 현재 content + updated_at 조회 (E1 보호, E4 낙관적 잠금용)
    const { data, error: fetchErr } = await supabase
      .from(table)
      .select("ai_draft_content, content, updated_at")
      .eq("id", recordId)
      .single();
    if (fetchErr) throw fetchErr;

    if (!data?.ai_draft_content) {
      return createErrorResponse("AI 초안이 없습니다.");
    }

    // E1: 기존 content 보호 — force 없이 호출하면 클라이언트가 확인하도록 에러 반환
    if (data.content?.trim() && !force) {
      return { success: false, error: "CONTENT_EXISTS" };
    }

    // E4: 낙관적 잠금 — 조회 시점의 updated_at 이 변하지 않았는지 확인
    const { error, count } = await supabase
      .from(table)
      .update({
        content: data.ai_draft_content,
        // E2: 수용 후 AI 초안 초기화 (배너/버튼이 다시 노출되지 않도록)
        ai_draft_content: null,
        ai_draft_at: null,
        // B5: AI 초안 수용 → 검토 중 단계로 전환
        status: "review",
      })
      .eq("id", recordId)
      .eq("updated_at", data.updated_at)
      .select("id");

    if (error) throw error;
    // count 가 0 이면 다른 사용자가 그 사이에 수정한 것
    if (count === 0) {
      return { success: false, error: "CONFLICT" };
    }

    // B6: 수용 후 side effects (개별 실패 무시, 주요 흐름 차단 없음)
    try {
      const { markRelatedEdgesStale, markRelatedAssignmentsStale } = await import("../stale-detection");
      await markRelatedEdgesStale(recordId).catch((err) => logActionWarn(LOG_CTX, `acceptAiDraft.markRelatedEdgesStale failed: ${err instanceof Error ? err.message : String(err)}`));
      await markRelatedAssignmentsStale(recordId).catch((err) => logActionWarn(LOG_CTX, `acceptAiDraft.markRelatedAssignmentsStale failed: ${err instanceof Error ? err.message : String(err)}`));
    } catch (sideEffectErr) {
      logActionWarn(LOG_CTX, `acceptAiDraft side effects failed: ${sideEffectErr instanceof Error ? sideEffectErr.message : String(sideEffectErr)}`);
    }

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

    // 현재 content + B6 side effect용 필드 조회
    const { data, error: fetchErr } = await supabase
      .from(table)
      .select("content, student_id, subject_id, grade")
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
        // B5: 가안 확정 → 확정 단계로 전환
        status: "final",
      })
      .eq("id", recordId);
    if (error) throw error;

    // B6: 확정 후 side effects (개별 실패 무시, 주요 흐름 차단 없음)
    try {
      const {
        markRelatedEdgesStale,
        markRelatedAssignmentsStale,
        autoMatchRoadmapOnConfirm,
      } = await import("../stale-detection");
      await markRelatedEdgesStale(recordId).catch((err) => logActionWarn(LOG_CTX, `confirmDraft.markRelatedEdgesStale failed: ${err instanceof Error ? err.message : String(err)}`));
      await markRelatedAssignmentsStale(recordId).catch((err) => logActionWarn(LOG_CTX, `confirmDraft.markRelatedAssignmentsStale failed: ${err instanceof Error ? err.message : String(err)}`));

      if (recordType === "setek" && data.student_id && data.subject_id && typeof data.grade === "number") {
        await autoMatchRoadmapOnConfirm(data.student_id, data.subject_id, data.grade).catch((err) => logActionWarn(LOG_CTX, `confirmDraft.autoMatchRoadmapOnConfirm failed: ${err instanceof Error ? err.message : String(err)}`));
      }
    } catch (sideEffectErr) {
      logActionWarn(LOG_CTX, `confirmDraft side effects failed: ${sideEffectErr instanceof Error ? sideEffectErr.message : String(sideEffectErr)}`);
    }

    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "confirmDraft" }, error, { recordId, recordType });
    return createErrorResponse("가안 확정에 실패했습니다.");
  }
}

// ── 3. 확정 되돌리기 ──

/** 확정본 → 검토 중으로 되돌리기 (confirmed_content 초기화, status → "review") */
export async function revertConfirmAction(
  recordId: string,
  recordType: "setek" | "changche" | "haengteuk" | "personal_setek",
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();
    const table = TABLE_MAP[recordType];

    // 현재 confirmed_content 존재 여부 확인
    const { data, error: fetchErr } = await supabase
      .from(table)
      .select("confirmed_content")
      .eq("id", recordId)
      .single();
    if (fetchErr) throw fetchErr;

    if (!data?.confirmed_content?.trim()) {
      return createErrorResponse("확정된 내용이 없습니다.");
    }

    const { error } = await supabase
      .from(table)
      .update({
        confirmed_content: null,
        confirmed_at: null,
        confirmed_by: null,
        // 확정 취소 → 검토 중으로 되돌림
        status: "review",
      })
      .eq("id", recordId);
    if (error) throw error;

    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "revertConfirm" }, error, { recordId, recordType });
    return createErrorResponse("확정 취소에 실패했습니다.");
  }
}

// ── 4. 분석 태그 확정 ──

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
