/**
 * 템플릿 블록 세트 조회 통합 함수
 * 
 * 여러 곳에서 중복 구현된 템플릿 블록 세트 조회 로직을 단일 함수로 통합합니다.
 * 
 * 조회 순서:
 * 1. camp_template_block_sets 연결 테이블 (우선)
 * 2. scheduler_options.template_block_set_id (Fallback)
 * 3. template_data.block_set_id (하위 호환성)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCampTemplate } from "@/lib/data/campTemplates";
import { logError } from "@/lib/errors/handler";
import type { SchedulerOptions } from "@/lib/types/plan/domain";
import type { BlockInfo } from "@/lib/plan/blocks";

/**
 * Supabase Server Client 타입
 */
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 템플릿 블록 세트 ID 조회 옵션
 */
export interface ResolveTemplateBlockSetIdOptions {
  /** 캠프 템플릿 ID */
  templateId: string;
  /** 스케줄러 옵션 (Fallback용, 선택사항) */
  schedulerOptions?: SchedulerOptions | null;
  /** 테넌트 ID (선택사항) */
  tenantId?: string | null;
}

/**
 * 템플릿 블록 세트 정보 조회 옵션
 */
export interface GetTemplateBlockSetInfoOptions extends ResolveTemplateBlockSetIdOptions {
  /** 블록 정보 포함 여부 (기본값: false) */
  includeBlocks?: boolean;
  /** 블록 세트 이름 포함 여부 (기본값: false) */
  includeName?: boolean;
}

/**
 * 템플릿 블록 세트 정보 반환 타입
 */
export interface TemplateBlockSetInfo {
  /** 블록 세트 ID */
  id: string;
  /** 블록 세트 이름 (includeName이 true일 때만) */
  name?: string;
  /** 블록 정보 배열 (includeBlocks가 true일 때만) */
  blocks?: BlockInfo[];
}

/**
 * 템플릿 블록 세트 ID 조회 (통합 함수)
 * 
 * 조회 순서:
 * 1. camp_template_block_sets 연결 테이블 (우선)
 * 2. scheduler_options.template_block_set_id (Fallback)
 * 3. template_data.block_set_id (하위 호환성)
 * 
 * @param supabase Supabase 클라이언트 (선택사항, 제공하지 않으면 내부에서 생성)
 * @param options 조회 옵션
 * @returns tenant_block_set_id 또는 null (조회 실패 시)
 * 
 * @example
 * ```typescript
 * const blockSetId = await resolveTemplateBlockSetId(undefined, {
 *   templateId: "template-123",
 *   schedulerOptions: { template_block_set_id: "fallback-id" },
 *   tenantId: "tenant-id"
 * });
 * ```
 */
export async function resolveTemplateBlockSetId(
  supabase: SupabaseServerClient | undefined,
  options: ResolveTemplateBlockSetIdOptions
): Promise<string | null> {
  const { templateId, schedulerOptions, tenantId } = options;
  
  // Supabase 클라이언트 생성 (제공되지 않은 경우)
  const client = supabase ?? await createSupabaseServerClient();

  // 1. 연결 테이블에서 직접 조회 (가장 직접적이고 명확한 방법)
  const { data: templateBlockSetLink, error: linkError } = await client
    .from("camp_template_block_sets")
    .select("tenant_block_set_id")
    .eq("camp_template_id", templateId)
    .maybeSingle();

  if (linkError) {
    logError(linkError, {
      function: "resolveTemplateBlockSetId",
      templateId,
      code: linkError.code,
      details: linkError.details,
      hint: linkError.hint,
      level: "warn", // 연결 테이블 조회 실패는 치명적이지 않을 수 있으므로 경고 레벨
    });
    // 연결 테이블 조회 실패는 치명적이지 않을 수 있으므로 fallback으로 진행
  } else if (templateBlockSetLink?.tenant_block_set_id) {
    return templateBlockSetLink.tenant_block_set_id;
  }

  // 2. scheduler_options에서 template_block_set_id 확인 (Fallback)
  if (schedulerOptions) {
    // SchedulerOptions 타입에 template_block_set_id가 명시적으로 정의되어 있지 않지만,
    // 실제로는 확장 가능한 구조이므로 타입 단언 사용
    const schedulerOptionsWithBlockSet = schedulerOptions as SchedulerOptions & {
      template_block_set_id?: string;
    };
    
    if (schedulerOptionsWithBlockSet.template_block_set_id) {
      return schedulerOptionsWithBlockSet.template_block_set_id;
    }
  }

  // 3. template_data에서 block_set_id 확인 (하위 호환성)
  try {
    const template = await getCampTemplate(templateId);
    if (template?.template_data) {
      let templateData: { block_set_id?: string } | null = null;
      
      if (typeof template.template_data === "string") {
        templateData = JSON.parse(template.template_data) as { block_set_id?: string };
      } else if (typeof template.template_data === "object" && template.template_data !== null) {
        templateData = template.template_data as { block_set_id?: string };
      }

      if (templateData?.block_set_id && typeof templateData.block_set_id === "string") {
        return templateData.block_set_id;
      }
    }
  } catch (parseError) {
    logError(parseError instanceof Error ? parseError : new Error(String(parseError)), {
      function: "resolveTemplateBlockSetId",
      templateId,
      level: "warn", // 파싱 에러는 치명적이지 않으므로 경고 레벨
    });
    // 파싱 에러는 치명적이지 않으므로 null 반환
  }

  // 모든 조회 방법이 실패한 경우 null 반환
  logError(
    new Error("템플릿 블록 세트 ID를 찾을 수 없습니다."),
    {
      function: "resolveTemplateBlockSetId",
      templateId,
      tenantId,
      hasSchedulerOptions: !!schedulerOptions,
      level: "warn",
    }
  );
  
  return null;
}

/**
 * 템플릿 블록 세트 정보 조회 (통합 함수)
 * 
 * 블록 세트 ID, 이름, 블록 정보를 포함한 완전한 정보를 조회합니다.
 * 
 * @param supabase Supabase 클라이언트 (선택사항, 제공하지 않으면 내부에서 생성)
 * @param options 조회 옵션
 * @returns 템플릿 블록 세트 정보 또는 null (조회 실패 시)
 * 
 * @example
 * ```typescript
 * const blockSetInfo = await getTemplateBlockSetInfo(undefined, {
 *   templateId: "template-123",
 *   includeBlocks: true,
 *   includeName: true,
 *   schedulerOptions: { template_block_set_id: "fallback-id" },
 *   tenantId: "tenant-id"
 * });
 * ```
 */
export async function getTemplateBlockSetInfo(
  supabase: SupabaseServerClient | undefined,
  options: GetTemplateBlockSetInfoOptions
): Promise<TemplateBlockSetInfo | null> {
  const { templateId, includeBlocks = false, includeName = false, schedulerOptions, tenantId } = options;
  
  // Supabase 클라이언트 생성 (제공되지 않은 경우)
  const client = supabase ?? await createSupabaseServerClient();

  // 1. 블록 세트 ID 조회
  const blockSetId = await resolveTemplateBlockSetId(client, {
    templateId,
    schedulerOptions,
    tenantId,
  });

  if (!blockSetId) {
    return null;
  }

  const result: TemplateBlockSetInfo = {
    id: blockSetId,
  };

  // 2. 블록 세트 이름 조회 (필요한 경우)
  if (includeName) {
    const { data: blockSet, error: blockSetError } = await client
      .from("tenant_block_sets")
      .select("name")
      .eq("id", blockSetId)
      .maybeSingle();

    if (blockSetError) {
      logError(blockSetError, {
        function: "getTemplateBlockSetInfo",
        templateId,
        blockSetId,
        code: blockSetError.code,
        details: blockSetError.details,
        hint: blockSetError.hint,
        level: "warn",
      });
    } else if (blockSet?.name) {
      result.name = blockSet.name;
    }
  }

  // 3. 블록 정보 조회 (필요한 경우)
  if (includeBlocks) {
    const { data: blockRows, error: blocksError } = await client
      .from("tenant_blocks")
      .select("day_of_week, start_time, end_time")
      .eq("tenant_block_set_id", blockSetId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (blocksError) {
      logError(blocksError, {
        function: "getTemplateBlockSetInfo",
        templateId,
        blockSetId,
        code: blocksError.code,
        details: blocksError.details,
        hint: blocksError.hint,
      });
      // DB 에러는 throw하여 호출자가 캐시 미스와 구분할 수 있도록 함
      throw new Error(`템플릿 블록 세트 조회 실패: ${blocksError.message}`);
    }

    if (blockRows && blockRows.length > 0) {
      result.blocks = blockRows.map((b) => ({
        day_of_week: b.day_of_week ?? 0,
        start_time: b.start_time ?? "00:00",
        end_time: b.end_time ?? "00:00",
      }));
    } else {
      result.blocks = [];
    }
  }

  return result;
}

