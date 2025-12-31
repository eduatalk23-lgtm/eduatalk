/**
 * 플랜 그룹 콘텐츠 관련 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleQueryError } from "@/lib/data/core/errorHandler";
import { ErrorCodeCheckers } from "@/lib/constants/errorCodes";
import { logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import { isPlanContentWithDetails } from "@/lib/types/guards";
import type { PlanContent, PlanContentWithDetails } from "./types";

/**
 * 플랜 그룹의 콘텐츠 목록 조회
 */
export async function getPlanContents(
  groupId: string,
  tenantId?: string | null
): Promise<PlanContent[]> {
  const supabase = await createSupabaseServerClient();

  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "getPlanContents" },
      "플랜 콘텐츠 조회 시작",
      { groupId, tenantId }
    );
  }

  const selectContents = () =>
    supabase
      .from("plan_contents")
      .select(
        "id,tenant_id,plan_group_id,content_type,content_id,master_content_id,start_range,end_range,start_detail_id,end_detail_id,display_order,is_auto_recommended,recommendation_source,recommendation_reason,recommendation_metadata,recommended_at,recommended_by,created_at,updated_at"
      )
      .eq("plan_group_id", groupId)
      .order("display_order", { ascending: true });

  let query = selectContents();
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  let { data, error } = await query;

  if (process.env.NODE_ENV === "development") {
    logActionDebug(
      { domain: "data", action: "getPlanContents" },
      "플랜 콘텐츠 조회 결과",
      {
        groupId,
        tenantId,
        dataCount: data?.length || 0,
        error: error ? { message: error.message, code: error.code } : null,
      }
    );
  }

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    // 컬럼이 없는 경우 fallback 쿼리 시도
    const fallbackSelect = () =>
      supabase
        .from("plan_contents")
        .select("id,tenant_id,plan_group_id,content_type,content_id,master_content_id,start_range,end_range,start_detail_id,end_detail_id,display_order,is_auto_recommended,recommendation_source,recommendation_reason,recommendation_metadata,recommended_at,recommended_by,created_at,updated_at")
        .eq("plan_group_id", groupId)
        .order("display_order", { ascending: true });

    let fallbackQuery = fallbackSelect();
    if (tenantId) {
      fallbackQuery = fallbackQuery.eq("tenant_id", tenantId);
    }

    ({ data, error } = await fallbackQuery);
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] getPlanContents",
    });

    // 에러가 발생해도 빈 배열 반환 (페이지가 깨지지 않도록)
    return [];
  }

  return (data as PlanContent[] | null) ?? [];
}

/**
 * 플랜 그룹에 콘텐츠 일괄 생성
 */
export async function createPlanContents(
  groupId: string,
  tenantId: string,
  contents: Array<{
    content_type: string;
    content_id: string;
    master_content_id?: string | null; // 마스터 콘텐츠 ID (학생 콘텐츠가 마스터 콘텐츠와 연계된 경우)
    start_range: number;
    end_range: number;
    display_order?: number;
    // 자동 추천 관련 필드 (선택)
    is_auto_recommended?: boolean;
    recommendation_source?: "auto" | "admin" | "template" | null;
    recommendation_reason?: string | null;
    recommendation_metadata?: {
      scoreDetails?: {
        schoolGrade?: number | null;
        schoolAverageGrade?: number | null;
        mockPercentile?: number | null;
        mockGrade?: number | null;
        riskScore?: number;
      };
      priority?: number;
    } | null;
    recommended_at?: string | null;
    recommended_by?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (contents.length === 0) {
    return { success: true };
  }

  const payload = contents.map((content, index) => {
    // PlanContentWithDetails 타입으로 안전하게 처리
    const contentWithDetails: PlanContentWithDetails = isPlanContentWithDetails(content as PlanContent | PlanContentWithDetails)
      ? (content as PlanContentWithDetails)
      : { ...content, start_detail_id: null, end_detail_id: null } as PlanContentWithDetails;

    return {
      tenant_id: tenantId,
      plan_group_id: groupId,
      content_type: content.content_type,
      content_id: content.content_id,
      master_content_id: content.master_content_id ?? null,
      start_range: content.start_range,
      end_range: content.end_range,
      start_detail_id: 'start_detail_id' in contentWithDetails
        ? contentWithDetails.start_detail_id ?? null
        : null,
      end_detail_id: 'end_detail_id' in contentWithDetails
        ? contentWithDetails.end_detail_id ?? null
        : null,
      display_order: content.display_order ?? index,
      // 자동 추천 관련 필드
      is_auto_recommended: content.is_auto_recommended ?? false,
      recommendation_source: content.recommendation_source ?? null,
      recommendation_reason: content.recommendation_reason ?? null,
      recommendation_metadata: content.recommendation_metadata ?? null,
      recommended_at: content.recommended_at ?? null,
      recommended_by: content.recommended_by ?? null,
    };
  });

  let { error } = await supabase.from("plan_contents").insert(payload);

  if (error && ErrorCodeCheckers.isColumnNotFound(error)) {
    if (process.env.NODE_ENV === "development") {
      logActionWarn(
        { domain: "data", action: "createPlanContents" },
        "컬럼이 없어 fallback 쿼리 사용",
        { groupId, tenantId }
      );
    }
    // 필드가 없는 경우 fallback (하위 호환성)
    const fallbackPayload = payload.map(({
      tenant_id: _tenantId,
      master_content_id: _masterContentId,
      is_auto_recommended: _isAuto,
      recommendation_source: _source,
      recommendation_reason: _reason,
      recommendation_metadata: _metadata,
      recommended_at: _at,
      recommended_by: _by,
      ...rest
    }) => rest);
    ({ error } = await supabase.from("plan_contents").insert(fallbackPayload));
  }

  if (error) {
    handleQueryError(error, {
      context: "[data/planGroups] createPlanContents",
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}
