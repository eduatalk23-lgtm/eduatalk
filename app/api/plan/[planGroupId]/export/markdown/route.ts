import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildMarkdownExportData,
  renderMarkdown,
} from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration";
import type { ResolvedContentItem } from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  handleApiError,
} from "@/lib/api";

interface RouteContext {
  params: Promise<{ planGroupId: string }>;
}

/**
 * 기존 플랜 그룹을 마크다운으로 내보내기
 *
 * GET /api/plan/[planGroupId]/export/markdown
 *
 * 이미 생성된 플랜 그룹을 마크다운 형식으로 내보냅니다.
 *
 * @example Response (Success)
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "markdown": "# 1학기 수학 학습 플랜\n...",
 *     "planGroup": { "id": "...", "name": "..." }
 *   }
 * }
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // 1. 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return apiUnauthorized("로그인이 필요합니다");
    }

    // 2. 권한 확인
    const userRole = await getCurrentUserRole();
    if (!userRole.role) {
      return apiForbidden("접근 권한이 없습니다");
    }

    // 3. planGroupId 파라미터 가져오기
    const { planGroupId } = await context.params;

    // 4. 플랜 그룹 조회
    const supabase = await createSupabaseServerClient();

    const { data: planGroup, error: groupError } = await supabase
      .from("plan_groups")
      .select("*")
      .eq("id", planGroupId)
      .single();

    if (groupError || !planGroup) {
      return apiNotFound("플랜 그룹을 찾을 수 없습니다");
    }

    // 5. 플랜 목록 조회
    const { data: plans, error: plansError } = await supabase
      .from("student_plans")
      .select("*")
      .eq("plan_group_id", planGroupId)
      .order("plan_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (plansError) {
      return apiNotFound("플랜을 조회할 수 없습니다");
    }

    // 6. 콘텐츠 정보 조회
    const { data: planContents, error: contentsError } = await supabase
      .from("plan_contents")
      .select("*")
      .eq("plan_group_id", planGroupId);

    if (contentsError) {
      return apiNotFound("콘텐츠 정보를 조회할 수 없습니다");
    }

    // 콘텐츠 정보를 ResolvedContentItem 형식으로 변환
    const contents: ResolvedContentItem[] = (planContents ?? []).map((c) => ({
      id: c.content_id,
      title: c.content_id, // 실제로는 master_content에서 조회해야 함
      contentType: c.content_type as "book" | "lecture",
      totalRange: (c.end_range ?? 0) - (c.start_range ?? 0) + 1,
      startRange: c.start_range ?? 1,
      endRange: c.end_range ?? 1,
      source: "db_cache" as const,
    }));

    // 7. 마크다운 생성
    const scheduledPlans = (plans ?? []).map((p) => ({
      plan_date: p.plan_date,
      block_index: p.block_index,
      content_type: p.content_type as "book" | "lecture" | "custom",
      content_id: p.content_id,
      planned_start_page_or_time: p.planned_start_page_or_time,
      planned_end_page_or_time: p.planned_end_page_or_time,
      is_reschedulable: p.is_reschedulable ?? true,
      start_time: p.start_time ?? undefined,
      end_time: p.end_time ?? undefined,
      date_type: p.date_type as "study" | "review" | "exclusion" | null,
      cycle_day_number: p.cycle_day_number ?? null,
    }));

    const exportData = buildMarkdownExportData(
      planGroup.name ?? "학습 플랜",
      planGroup.period_start,
      planGroup.period_end,
      planGroup.plan_purpose ?? "학습",
      scheduledPlans,
      contents
    );

    const markdown = renderMarkdown(exportData);

    // 8. 결과 반환
    return apiSuccess({
      markdown,
      planGroup: {
        id: planGroup.id,
        name: planGroup.name,
        periodStart: planGroup.period_start,
        periodEnd: planGroup.period_end,
        status: planGroup.status,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
