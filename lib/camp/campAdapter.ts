/**
 * 캠프 데이터 파싱 Adapter
 * 
 * 캠프 관련 데이터 파싱 로직을 중앙화하여 중복 제거 및 유지보수성 향상
 * Adapter 패턴을 적용하여 다양한 데이터 소스(template_data, scheduler_options, 레거시 데이터)를
 * 통일된 형식으로 변환합니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampTemplate, CampPlanConfig } from "@/lib/domains/camp/types";
import type { PlanGroup } from "@/lib/types/plan";
import type { WizardData } from "@/app/(student)/plan/new-group/_components/PlanGroupWizard";
import type { Json } from "@/lib/supabase/database.types";

// CampPlanConfig 타입은 lib/domains/camp/types.ts에서 export
export type { CampPlanConfig };

/**
 * 템플릿 데이터 타입 (안전한 파싱을 위한 타입)
 */
export type CampTemplateData = Partial<WizardData> & {
  block_set_id?: string;
};

/**
 * 스케줄러 옵션 타입
 */
export type CampSchedulerOptions = {
  template_block_set_id?: string;
  [key: string]: unknown;
};

/**
 * template_data 안전 파싱
 * 
 * @param templateDataRaw - 파싱할 template_data (string 또는 object)
 * @returns 파싱된 template_data 또는 null
 */
export function parseTemplateData(
  templateDataRaw: unknown
): CampTemplateData | null {
  if (!templateDataRaw) {
    return null;
  }

  if (typeof templateDataRaw === "string") {
    try {
      const parsed = JSON.parse(templateDataRaw);
      return parsed as CampTemplateData;
    } catch (parseError) {
      console.error("[campAdapter] template_data 파싱 에러:", parseError);
      return null;
    }
  }

  if (typeof templateDataRaw === "object" && templateDataRaw !== null) {
    return templateDataRaw as CampTemplateData;
  }

  return null;
}

/**
 * scheduler_options 안전 파싱
 * 
 * @param schedulerOptionsRaw - 파싱할 scheduler_options (string 또는 object)
 * @returns 파싱된 scheduler_options 또는 null
 */
export function parseSchedulerOptions(
  schedulerOptionsRaw: unknown
): CampSchedulerOptions | null {
  if (!schedulerOptionsRaw) {
    return null;
  }

  if (typeof schedulerOptionsRaw === "string") {
    try {
      const parsed = JSON.parse(schedulerOptionsRaw);
      return parsed as CampSchedulerOptions;
    } catch (parseError) {
      console.error("[campAdapter] scheduler_options 파싱 에러:", parseError);
      return null;
    }
  }

  if (typeof schedulerOptionsRaw === "object" && schedulerOptionsRaw !== null) {
    return schedulerOptionsRaw as CampSchedulerOptions;
  }

  return null;
}

/**
 * 캠프 블록 세트 ID 조회 (3단계 우선순위)
 * 
 * 1. 연결 테이블(camp_template_block_sets)에서 직접 조회 (가장 직접적)
 * 2. scheduler_options.template_block_set_id 확인 (Fallback)
 * 3. template_data.block_set_id 확인 (하위 호환성, 마이그레이션 전 데이터용)
 * 
 * @param supabase - Supabase 클라이언트
 * @param campTemplateId - 캠프 템플릿 ID
 * @param group - 플랜 그룹 (scheduler_options 포함)
 * @param templateData - 파싱된 template_data (선택사항)
 * @returns 블록 세트 ID 또는 null
 */
export async function resolveCampBlockSetId(
  supabase: SupabaseClient,
  campTemplateId: string | null,
  group: Pick<PlanGroup, "scheduler_options">,
  templateData?: CampTemplateData | null
): Promise<string | null> {
  let blockSetId: string | null = null;

  // 1. 연결 테이블에서 직접 조회 (가장 직접적이고 명확한 방법)
  if (campTemplateId) {
    const { data: templateBlockSetLink, error: linkError } = await supabase
      .from("camp_template_block_sets")
      .select("tenant_block_set_id")
      .eq("camp_template_id", campTemplateId)
      .maybeSingle();

    if (linkError) {
      console.error(
        "[campAdapter] 템플릿 블록 세트 연결 조회 에러:",
        linkError
      );
    } else if (templateBlockSetLink) {
      blockSetId = templateBlockSetLink.tenant_block_set_id;
      console.log(
        "[campAdapter] 연결 테이블에서 block_set_id 발견:",
        blockSetId
      );
    }
  }

  // 2. scheduler_options에서 template_block_set_id 확인 (Fallback)
  if (!blockSetId && group.scheduler_options) {
    const schedulerOptions = parseSchedulerOptions(group.scheduler_options);
    if (schedulerOptions?.template_block_set_id) {
      blockSetId = schedulerOptions.template_block_set_id;
      console.log(
        "[campAdapter] scheduler_options에서 template_block_set_id 발견 (Fallback):",
        blockSetId
      );
    }
  }

  // 3. template_data에서 block_set_id 확인 (하위 호환성, 마이그레이션 전 데이터용)
  if (!blockSetId && templateData?.block_set_id) {
    blockSetId = templateData.block_set_id;
    console.log(
      "[campAdapter] template_data에서 block_set_id 발견 (하위 호환성):",
      blockSetId
    );
  }

  return blockSetId;
}

/**
 * 캠프 템플릿 블록 조회
 * 
 * @param supabase - Supabase 클라이언트
 * @param blockSetId - 블록 세트 ID
 * @param tenantId - 테넌트 ID (보안 검증용)
 * @returns 블록 목록 및 블록 세트 정보
 */
export async function fetchCampTemplateBlocks(
  supabase: SupabaseClient,
  blockSetId: string,
  tenantId: string | null
): Promise<{
  blocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
  blockSetName: string | null;
  blockSetId: string | null;
}> {
  const result = {
    blocks: [] as Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>,
    blockSetName: null as string | null,
    blockSetId: null as string | null,
  };

  if (!blockSetId || !tenantId) {
    return result;
  }

  // 테넌트 블록 세트 조회 (보안을 위해 tenant_id 검증)
  const { data: blockSetData, error: blockSetError } = await supabase
    .from("tenant_block_sets")
    .select("id, name")
    .eq("id", blockSetId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (blockSetError) {
    console.error("[campAdapter] 테넌트 블록 세트 조회 에러:", {
      error: blockSetError,
      block_set_id: blockSetId,
      tenant_id: tenantId,
    });
    return result;
  }

  if (!blockSetData) {
    console.warn("[campAdapter] 블록 세트를 찾을 수 없습니다:", {
      block_set_id: blockSetId,
      tenant_id: tenantId,
    });
    return result;
  }

  result.blockSetName = blockSetData.name;
  result.blockSetId = blockSetData.id;

  // 테넌트 블록 조회
  const { data: blocks, error: blocksError } = await supabase
    .from("tenant_blocks")
    .select("id, day_of_week, start_time, end_time")
    .eq("tenant_block_set_id", blockSetData.id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (blocksError) {
    console.error("[campAdapter] 템플릿 블록 조회 에러:", {
      error: blocksError,
      block_set_id: blockSetData.id,
    });
    return result;
  }

  if (blocks && blocks.length > 0) {
    result.blocks = blocks.map((b) => ({
      id: b.id,
      day_of_week: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
    }));
    console.log("[campAdapter] 템플릿 블록 조회 성공:", {
      count: result.blocks.length,
      block_set_id: blockSetData.id,
    });
  } else {
    console.warn("[campAdapter] 템플릿 블록이 없음:", {
      block_set_id: blockSetData.id,
      block_set_name: blockSetData.name,
    });
  }

  return result;
}

/**
 * 캠프 플랜 설정 파싱 (통합 함수)
 * 
 * 템플릿 데이터, 스케줄러 옵션, 레거시 호환성을 처리하여 통일된 CampPlanConfig 객체를 반환합니다.
 * 
 * @param supabase - Supabase 클라이언트
 * @param group - 플랜 그룹
 * @param template - 캠프 템플릿 (선택사항)
 * @param tenantId - 테넌트 ID
 * @returns 캠프 플랜 설정 정보
 */
export async function parseCampConfiguration(
  supabase: SupabaseClient,
  group: Pick<PlanGroup, "camp_template_id" | "scheduler_options">,
  template: CampTemplate | null,
  tenantId: string | null
): Promise<CampPlanConfig> {
  const defaultConfig: CampPlanConfig = {
    blockSetId: null,
    templateBlocks: [],
    templateBlockSetName: null,
    templateBlockSetId: null,
    isLegacy: false,
  };

  // 캠프 모드가 아니거나 템플릿 ID가 없으면 기본값 반환
  if (!group.camp_template_id) {
    return defaultConfig;
  }

  try {
    // template_data 파싱
    const templateData = template
      ? parseTemplateData(template.template_data)
      : null;

    // 블록 세트 ID 조회 (3단계 우선순위)
    const blockSetId = await resolveCampBlockSetId(
      supabase,
      group.camp_template_id,
      group,
      templateData
    );

    if (!blockSetId) {
      console.warn("[campAdapter] block_set_id를 찾을 수 없음:", {
        template_id: group.camp_template_id,
        template_data_has_block_set_id: !!templateData?.block_set_id,
        scheduler_options_has_template_block_set_id: !!parseSchedulerOptions(
          group.scheduler_options
        )?.template_block_set_id,
      });
      return {
        ...defaultConfig,
        isLegacy: !!templateData?.block_set_id, // 레거시 데이터가 있으면 true
      };
    }

    // 템플릿 블록 조회
    const { blocks, blockSetName, blockSetId: resolvedBlockSetId } =
      await fetchCampTemplateBlocks(supabase, blockSetId, tenantId);

    return {
      blockSetId: resolvedBlockSetId,
      templateBlocks: blocks,
      templateBlockSetName: blockSetName,
      templateBlockSetId: resolvedBlockSetId,
      isLegacy: false, // 연결 테이블이나 scheduler_options에서 찾았으면 레거시 아님
    };
  } catch (error) {
    console.error("[campAdapter] 캠프 설정 파싱 중 에러:", error);
    return defaultConfig;
  }
}

