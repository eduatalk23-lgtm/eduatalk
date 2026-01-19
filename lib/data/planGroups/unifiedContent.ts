/**
 * 플랜 그룹 통합 콘텐츠 접근 모듈
 *
 * Phase 5: 단일 콘텐츠 모드(is_single_content=true)와 레거시 다중 콘텐츠 모드를
 * 통합하여 처리하는 헬퍼 함수들을 제공합니다.
 *
 * 사용 가이드:
 * - 새 코드에서는 이 모듈의 함수를 사용하세요
 * - getPlanContents/createPlanContents 직접 호출은 레거시 코드에서만 사용
 *
 * @see docs/architecture/plan-system-unification.md
 */

import type { PlanGroup, PlanContent } from "@/lib/types/plan";
import { getPlanContents } from "./contents";

/**
 * 통합 콘텐츠 정보 타입
 * plan_groups 필드 또는 plan_contents에서 추출한 콘텐츠 정보
 */
export type UnifiedContentInfo = {
  content_type: string;
  content_id: string;
  master_content_id: string | null;
  start_range: number | null;
  end_range: number | null;
  start_detail_id: string | null;
  end_detail_id: string | null;
  display_order: number;
  /** 단일 콘텐츠 모드에서 온 경우 true */
  from_single_content_mode: boolean;
};

/**
 * 플랜 그룹에서 콘텐츠 정보 추출 (통합)
 *
 * 단일 콘텐츠 모드(is_single_content=true)인 경우 plan_groups 필드에서,
 * 다중 콘텐츠 모드인 경우 plan_contents 테이블에서 콘텐츠 정보를 가져옵니다.
 *
 * @param group - 플랜 그룹 (is_single_content, content_* 필드 필요)
 * @param tenantId - 테넌트 ID (다중 콘텐츠 모드에서 필요)
 * @returns 통합 콘텐츠 정보 배열
 *
 * @example
 * ```typescript
 * const contents = await getUnifiedContents(planGroup, tenantId);
 * for (const content of contents) {
 *   console.log(content.content_type, content.content_id);
 * }
 * ```
 */
export async function getUnifiedContents(
  group: PlanGroup,
  tenantId?: string | null
): Promise<UnifiedContentInfo[]> {
  // 단일 콘텐츠 모드: plan_groups 필드에서 직접 추출
  if (group.is_single_content && group.content_id) {
    return [
      {
        content_type: group.content_type ?? "book",
        content_id: group.content_id,
        master_content_id: group.master_content_id ?? null,
        start_range: group.start_range ?? null,
        end_range: group.end_range ?? null,
        start_detail_id: group.start_detail_id ?? null,
        end_detail_id: group.end_detail_id ?? null,
        display_order: 0,
        from_single_content_mode: true,
      },
    ];
  }

  // 다중 콘텐츠 모드 또는 레거시: plan_contents 테이블에서 조회
  const planContents = await getPlanContents(group.id, tenantId);
  return planContents.map((pc, index) => ({
    content_type: pc.content_type,
    content_id: pc.content_id,
    master_content_id: pc.master_content_id ?? null,
    start_range: pc.start_range ?? null,
    end_range: pc.end_range ?? null,
    start_detail_id: pc.start_detail_id ?? null,
    end_detail_id: pc.end_detail_id ?? null,
    display_order: pc.display_order ?? index,
    from_single_content_mode: false,
  }));
}

/**
 * 플랜 그룹에서 콘텐츠 정보 동기 추출 (DB 조회 없음)
 *
 * 단일 콘텐츠 모드에서만 사용 가능합니다.
 * 다중 콘텐츠 모드에서는 null을 반환합니다.
 *
 * @param group - 플랜 그룹
 * @returns 단일 콘텐츠 정보 또는 null
 */
export function getSingleContentFromGroup(
  group: PlanGroup
): UnifiedContentInfo | null {
  if (!group.is_single_content || !group.content_id) {
    return null;
  }

  return {
    content_type: group.content_type ?? "book",
    content_id: group.content_id,
    master_content_id: group.master_content_id ?? null,
    start_range: group.start_range ?? null,
    end_range: group.end_range ?? null,
    start_detail_id: group.start_detail_id ?? null,
    end_detail_id: group.end_detail_id ?? null,
    display_order: 0,
    from_single_content_mode: true,
  };
}

/**
 * 플랜 그룹이 콘텐츠를 가지고 있는지 확인
 *
 * @param group - 플랜 그룹
 * @returns 콘텐츠가 있으면 true
 */
export function hasContent(group: PlanGroup): boolean {
  // 단일 콘텐츠 모드
  if (group.is_single_content) {
    return !!group.content_id;
  }
  // 슬롯 모드
  if (group.use_slot_mode && group.content_slots) {
    return group.content_slots.length > 0;
  }
  // 다중 콘텐츠 모드는 DB 조회 필요하므로 여기서는 판단 불가
  // 호출자가 getUnifiedContents로 확인해야 함
  return false;
}

/**
 * 플랜 그룹의 콘텐츠 모드 확인
 */
export type ContentMode = "single" | "slot" | "legacy_multi" | "empty";

export function getContentMode(group: PlanGroup): ContentMode {
  if (group.is_single_content && group.content_id) {
    return "single";
  }
  if (group.use_slot_mode && group.content_slots?.length) {
    return "slot";
  }
  if (group.is_single_content === false) {
    return "legacy_multi";
  }
  return "empty";
}
