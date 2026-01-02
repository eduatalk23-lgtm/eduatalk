/**
 * Progress Service
 *
 * 플랜 완료 시 진행률 계산 및 업데이트를 담당합니다.
 *
 * TODAY-001: completePlan 함수에서 진행률 관련 로직 분리
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchContentTotal, type ContentType } from "@/lib/data/contentTotal";
import { timerLogger } from "../logger";

/**
 * 진행률 계산 입력
 */
export interface ProgressCalculationInput {
  planId: string;
  studentId: string;
  tenantId: string | null;
  contentType: string;
  contentId: string | null;
  startPageOrTime: number;
  endPageOrTime: number;
  planIds: string[]; // 같은 plan_number를 가진 모든 플랜 ID
}

/**
 * 진행률 계산 결과
 */
export interface ProgressCalculationResult {
  success: boolean;
  completedAmount?: number;
  progress?: number;
  totalAmount?: number;
  error?: string;
}

/**
 * 콘텐츠 총량 조회 및 검증
 */
export async function validateAndFetchContentTotal(
  supabase: SupabaseClient,
  studentId: string,
  contentType: string,
  contentId: string | null,
  planId: string
): Promise<{ success: boolean; totalAmount?: number; error?: string }> {
  if (!contentType || !contentId) {
    return { success: false, error: "콘텐츠 정보가 없습니다." };
  }

  try {
    const totalAmount = await fetchContentTotal(
      supabase,
      studentId,
      contentType as ContentType,
      contentId
    );

    if (totalAmount === null) {
      timerLogger.error("콘텐츠 총량이 null", {
        action: "validateAndFetchContentTotal",
        id: planId,
        userId: studentId,
        data: { contentType, contentId },
      });
      return {
        success: false,
        error: `콘텐츠를 찾을 수 없거나 총량 정보가 설정되지 않았습니다. (${contentType}: ${contentId})`,
      };
    }

    if (totalAmount <= 0) {
      timerLogger.error("콘텐츠 총량이 0 이하", {
        action: "validateAndFetchContentTotal",
        id: planId,
        userId: studentId,
        data: { contentType, contentId, totalAmount },
      });
      return {
        success: false,
        error: `콘텐츠 총량이 0 이하입니다. 콘텐츠 설정에서 총량을 확인해주세요. (현재 총량: ${totalAmount})`,
      };
    }

    return { success: true, totalAmount };
  } catch (error) {
    timerLogger.error("콘텐츠 총량 조회 중 예외 발생", {
      action: "validateAndFetchContentTotal",
      id: planId,
      userId: studentId,
      data: { contentType, contentId },
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return {
      success: false,
      error: `콘텐츠 정보를 조회하는 중 오류가 발생했습니다. ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
    };
  }
}

/**
 * 진행률 계산
 */
export function calculateProgress(
  startPageOrTime: number,
  endPageOrTime: number,
  totalAmount: number
): { completedAmount: number; progress: number } {
  const completedAmount = endPageOrTime - startPageOrTime;
  const progress = Math.min(
    Math.round((completedAmount / totalAmount) * 100),
    100
  );
  return { completedAmount, progress };
}

/**
 * 플랜 진행률 배치 업데이트
 */
export async function updatePlanProgress(
  supabase: SupabaseClient,
  planIds: string[],
  studentId: string,
  completedAmount: number,
  progress: number,
  planId: string
): Promise<void> {
  const { error } = await supabase
    .from("student_plan")
    .update({
      completed_amount: completedAmount,
      progress: progress,
    })
    .in("id", planIds)
    .eq("student_id", studentId);

  if (error) {
    timerLogger.error("플랜 진행률 배치 업데이트 오류", {
      action: "updatePlanProgress",
      id: planId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * student_content_progress에 플랜별 진행률 기록
 */
export async function upsertPlanContentProgress(
  supabase: SupabaseClient,
  input: ProgressCalculationInput,
  completedAmount: number,
  progress: number
): Promise<void> {
  const normalizedContentId =
    input.contentId && input.contentId.trim() !== "" ? input.contentId : null;

  const progressTimestamp = new Date().toISOString();
  const progressPayloads = input.planIds.map((planIdForProgress) => ({
    student_id: input.studentId,
    tenant_id: input.tenantId,
    plan_id: planIdForProgress,
    content_type: input.contentType,
    content_id: normalizedContentId,
    progress: progress,
    start_page_or_time: input.startPageOrTime,
    end_page_or_time: input.endPageOrTime,
    completed_amount: completedAmount,
    last_updated: progressTimestamp,
  }));

  const { error } = await supabase
    .from("student_content_progress")
    .upsert(progressPayloads, {
      onConflict: "student_id,plan_id",
      ignoreDuplicates: false,
    });

  if (error) {
    timerLogger.error("플랜별 진행률 upsert 오류", {
      action: "upsertPlanContentProgress",
      id: input.planId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * 전체 콘텐츠 진행률 업데이트 (content_type + content_id 기준)
 */
export async function updateOverallContentProgress(
  supabase: SupabaseClient,
  studentId: string,
  tenantId: string | null,
  contentType: string,
  contentId: string | null,
  completedAmount: number,
  totalAmount: number
): Promise<void> {
  // content_id가 없는 경우 (자유 학습) 스킵
  const normalizedContentId =
    contentId && contentId.trim() !== "" ? contentId : null;

  if (!normalizedContentId) {
    return;
  }

  const { data: existingProgress } = await supabase
    .from("student_content_progress")
    .select("id, completed_amount")
    .eq("student_id", studentId)
    .eq("content_type", contentType)
    .eq("content_id", normalizedContentId)
    .is("plan_id", null)
    .maybeSingle();

  if (existingProgress) {
    // 기존 완료량에 추가
    const newCompletedAmount =
      (existingProgress.completed_amount || 0) + completedAmount;
    const newProgress = Math.min(
      Math.round((newCompletedAmount / totalAmount) * 100),
      100
    );

    await supabase
      .from("student_content_progress")
      .update({
        completed_amount: newCompletedAmount,
        progress: newProgress,
        last_updated: new Date().toISOString(),
      })
      .eq("id", existingProgress.id);
  } else {
    // 새로 생성
    const progress = Math.min(
      Math.round((completedAmount / totalAmount) * 100),
      100
    );

    await supabase.from("student_content_progress").insert({
      student_id: studentId,
      tenant_id: tenantId,
      content_type: contentType,
      content_id: normalizedContentId,
      completed_amount: completedAmount,
      progress: progress,
      last_updated: new Date().toISOString(),
    });
  }
}

/**
 * 진행률 관련 모든 업데이트를 한번에 처리
 */
export async function processProgressUpdates(
  supabase: SupabaseClient,
  input: ProgressCalculationInput,
  totalAmount: number
): Promise<{ completedAmount: number; progress: number }> {
  // 1. 진행률 계산
  const { completedAmount, progress } = calculateProgress(
    input.startPageOrTime,
    input.endPageOrTime,
    totalAmount
  );

  // 2. 플랜 진행률 배치 업데이트
  await updatePlanProgress(
    supabase,
    input.planIds,
    input.studentId,
    completedAmount,
    progress,
    input.planId
  );

  // 3. 플랜별 진행률 기록
  await upsertPlanContentProgress(supabase, input, completedAmount, progress);

  // 4. 전체 콘텐츠 진행률 업데이트
  await updateOverallContentProgress(
    supabase,
    input.studentId,
    input.tenantId,
    input.contentType,
    input.contentId,
    completedAmount,
    totalAmount
  );

  return { completedAmount, progress };
}
