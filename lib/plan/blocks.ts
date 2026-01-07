import type { PlanGroup } from "@/lib/types/plan";
import type { SupabaseClientForStudentQuery } from "@/lib/supabase/clientSelector";
import { selectClientForCrossAccess } from "@/lib/supabase/clientSelector";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanGroupAllowedRole } from "@/lib/auth/planGroupAuth";
import { PlanGroupError, PlanGroupErrorCodes, ErrorUserMessages } from "@/lib/errors/planGroupErrors";
import { logError } from "@/lib/errors/handler";
import { isCampMode } from "@/lib/plan/context";
import { resolveTemplateBlockSetId, getTemplateBlockSetInfo } from "@/lib/domains/camp/utils/templateBlockSetResolver";

export type BlockInfo = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type BlockSetInfo = {
  id: string;
  name: string;
  blocks: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
};

/**
 * 플랜 그룹에 맞는 블록 세트를 조회합니다.
 *
 * 조회 순서:
 * 1. 캠프 모드: 템플릿 블록 세트 조회 (연결 테이블 → 하위 호환성 → template_data)
 * 2. 일반 모드: 학생 블록 세트 조회 (block_set_id → active_block_set_id)
 *
 * 에러 처리:
 * - 캠프 모드에서 블록 세트를 찾을 수 없으면 PlanGroupError를 throw합니다.
 * - 일반 모드에서 블록 세트를 찾을 수 없으면 빈 배열을 반환하고 경고 로그를 남깁니다.
 *
 * @param group 플랜 그룹 객체
 * @param studentId 학생 ID
 * @param currentUserId 현재 사용자 ID
 * @param role 현재 사용자 역할 (student, admin, consultant 등)
 * @param tenantId 테넌트 ID (캠프 모드에서 필요)
 * @returns 블록 정보 배열 (day_of_week, start_time, end_time 포함)
 * @throws PlanGroupError - 캠프 모드에서 블록 세트를 찾을 수 없는 경우
 *
 * @example
 * ```typescript
 * // 캠프 모드
 * const blocks = await getBlockSetForPlanGroup(
 *   { plan_type: "camp", camp_template_id: "template-123", ... },
 *   "student-id",
 *   "user-id",
 *   "student",
 *   "tenant-id"
 * );
 *
 * // 일반 모드
 * const blocks = await getBlockSetForPlanGroup(
 *   { plan_type: "individual", block_set_id: "block-set-123", ... },
 *   "student-id",
 *   "user-id",
 *   "student"
 * );
 * ```
 */
export async function getBlockSetForPlanGroup(
  group: PlanGroup,
  studentId: string,
  currentUserId: string,
  role: PlanGroupAllowedRole,
  tenantId?: string | null
): Promise<BlockInfo[]> {
  let baseBlocks: BlockInfo[] = [];
  const isCamp = isCampMode(group);
  let dbErrorOccurred = false;

  // 캠프 모드: 템플릿 블록 세트 조회
  if (isCamp && group.camp_template_id) {
    try {
      const templateBlocks = await getTemplateBlockSet(
        group.camp_template_id,
        tenantId
      );
      if (templateBlocks && templateBlocks.length > 0) {
        baseBlocks = templateBlocks;
      }
    } catch (error) {
      // DB 에러 발생 시 로그 후 fallback 시도
      dbErrorOccurred = true;
      logError(error instanceof Error ? error : new Error(String(error)), {
        function: "getBlockSetForPlanGroup",
        source: "getTemplateBlockSet",
        groupId: group.id,
        campTemplateId: group.camp_template_id,
        message: "템플릿 블록 세트 DB 조회 실패, fallback 시도",
      });
    }
  }

  // 일반 모드: 학생 블록 세트 조회
  if (baseBlocks.length === 0 && group.block_set_id) {
    try {
      const studentBlocks = await getStudentBlockSet(
        group.block_set_id,
        studentId,
        currentUserId,
        role
      );
      if (studentBlocks && studentBlocks.length > 0) {
        baseBlocks = studentBlocks;
      }
    } catch (error) {
      // DB 에러 발생 시 로그 후 fallback 시도
      dbErrorOccurred = true;
      logError(error instanceof Error ? error : new Error(String(error)), {
        function: "getBlockSetForPlanGroup",
        source: "getStudentBlockSet",
        groupId: group.id,
        blockSetId: group.block_set_id,
        message: "학생 블록 세트 DB 조회 실패, fallback 시도",
      });
    }
  }

  // 기본 블록 세트 사용 (캠프 모드가 아닐 때만)
  if (baseBlocks.length === 0 && !isCamp) {
    try {
      const activeBlocks = await getActiveBlockSet(
        studentId,
        currentUserId,
        role
      );
      if (activeBlocks && activeBlocks.length > 0) {
        baseBlocks = activeBlocks;
      }
    } catch (error) {
      // DB 에러 발생 시 로그
      dbErrorOccurred = true;
      logError(error instanceof Error ? error : new Error(String(error)), {
        function: "getBlockSetForPlanGroup",
        source: "getActiveBlockSet",
        groupId: group.id,
        studentId,
        message: "활성 블록 세트 DB 조회 실패",
      });
    }
  }

  // 모든 조회 방법이 실패한 경우 에러 처리
  if (baseBlocks.length === 0) {
    const errorContext = {
      groupId: group.id,
      studentId,
      planType: group.plan_type,
      campTemplateId: group.camp_template_id,
      blockSetId: group.block_set_id,
      tenantId,
      dbErrorOccurred, // DB 에러로 인한 실패인지 여부
    };

    // 캠프 모드에서 블록 세트가 필수인 경우 에러 throw
    if (isCamp) {
      const errorMessage = dbErrorOccurred
        ? `캠프 템플릿(${group.camp_template_id}) 블록 세트 조회 중 데이터베이스 오류가 발생했습니다.`
        : `캠프 템플릿(${group.camp_template_id})에 연결된 블록 세트를 찾을 수 없습니다.`;
      const error = new PlanGroupError(
        errorMessage,
        PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND,
        ErrorUserMessages[PlanGroupErrorCodes.BLOCK_SET_NOT_FOUND],
        false,
        errorContext
      );
      logError(error, {
        function: "getBlockSetForPlanGroup",
        ...errorContext,
      });
      throw error;
    }

    // 일반 모드에서도 블록 세트가 없으면 경고 (빈 배열 반환)
    const warningMessage = dbErrorOccurred
      ? "블록 세트 DB 조회 실패로 빈 배열을 반환합니다."
      : "블록 세트가 없어 빈 배열을 반환합니다.";
    logError(
      new Error(warningMessage),
      {
        function: "getBlockSetForPlanGroup",
        level: "warn",
        ...errorContext,
      }
    );
  }

  return baseBlocks;
}

/**
 * 템플릿 블록 세트를 조회합니다.
 *
 * @deprecated 이 함수는 내부적으로 통합 함수를 사용합니다.
 * 새로운 코드에서는 `getTemplateBlockSetInfo`를 직접 사용하세요.
 *
 * @param templateId 캠프 템플릿 ID
 * @param tenantId 테넌트 ID (선택사항)
 * @returns 블록 정보 배열 또는 null (조회 실패 시)
 */
async function getTemplateBlockSet(
  templateId: string,
  tenantId?: string | null
): Promise<BlockInfo[] | null> {
  const supabase = await createSupabaseServerClient();
  
  try {
    const blockSetInfo = await getTemplateBlockSetInfo(supabase, {
      templateId,
      includeBlocks: true,
      tenantId,
    });

    return blockSetInfo?.blocks ?? null;
  } catch (error) {
    // DB 에러는 throw하여 호출자가 캐시 미스와 구분할 수 있도록 함
    throw error;
  }
}

/**
 * 템플릿 블록 세트 ID를 조회합니다.
 *
 * @deprecated 이 함수는 내부적으로 통합 함수를 사용합니다.
 * 새로운 코드에서는 `resolveTemplateBlockSetId`를 직접 사용하세요.
 *
 * 이 함수는 블록 세트 ID만 반환하며, 실제 블록 정보는 조회하지 않습니다.
 * 블록 정보가 필요한 경우 `getTemplateBlockSet` 함수를 사용하세요.
 *
 * @param templateId 캠프 템플릿 ID
 * @param schedulerOptions scheduler_options 객체 (Fallback용, 선택사항)
 * @param tenantId 테넌트 ID (선택사항)
 * @returns tenant_block_set_id 또는 null (조회 실패 시)
 *
 * @example
 * ```typescript
 * const blockSetId = await getTemplateBlockSetId(
 *   "template-123",
 *   { template_block_set_id: "fallback-id" }, // Fallback용
 *   "tenant-id"
 * );
 * ```
 */
import type { SchedulerOptions } from "@/lib/types/plan/domain";

export async function getTemplateBlockSetId(
  templateId: string,
  schedulerOptions?: SchedulerOptions | null,
  tenantId?: string | null
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  
  return await resolveTemplateBlockSetId(supabase, {
    templateId,
    schedulerOptions,
    tenantId,
  });
}

/**
 * 학생 블록 세트를 조회합니다.
 */
/**
 * 학생 블록 세트를 조회합니다.
 *
 * 블록 세트 소유자를 확인한 후, 해당 학생의 블록 스케줄을 조회합니다.
 * 관리자/컨설턴트가 다른 학생 데이터를 조회하는 경우 Admin 클라이언트를 사용합니다.
 *
 * @param blockSetId 블록 세트 ID
 * @param studentId 학생 ID
 * @param currentUserId 현재 사용자 ID
 * @param role 현재 사용자 역할
 * @returns 블록 정보 배열 또는 null (조회 실패 시)
 */
async function getStudentBlockSet(
  blockSetId: string,
  studentId: string,
  currentUserId: string,
  role: PlanGroupAllowedRole
): Promise<BlockInfo[] | null> {
  // 적절한 클라이언트 선택 (관리자/컨설턴트가 다른 학생 데이터 조회 시 Admin 클라이언트)
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const queryClient = await selectClientForCrossAccess(
    studentId,
    currentUserId,
    isAdminOrConsultant
  );

  if (!queryClient) {
    throw new Error("데이터베이스 클라이언트를 초기화할 수 없습니다.");
  }

  // 블록 세트 소유자 확인
  const { data: blockSet } = await queryClient
    .from("student_block_sets")
    .select("id, name, student_id")
    .eq("id", blockSetId)
    .maybeSingle();

  if (!blockSet) {
    return null;
  }

  const blockSetOwnerId = blockSet.student_id;

  // 블록 조회
  const { data: blockRows, error: blocksError } = await queryClient
    .from("student_block_schedule")
    .select("day_of_week, start_time, end_time")
    .eq("block_set_id", blockSetId)
    .eq("student_id", blockSetOwnerId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (blocksError) {
    logError(blocksError, {
      function: "getStudentBlockSet",
      blockSetId,
      studentId,
    });
    // DB 에러는 throw하여 호출자가 캐시 미스와 구분할 수 있도록 함
    throw new Error(`학생 블록 세트 조회 실패: ${blocksError.message}`);
  }

  // 블록이 없는 경우 (정상적인 캐시 미스) - null 반환
  if (!blockRows || blockRows.length === 0) {
    return null;
  }

  return blockRows.map((b) => ({
    day_of_week: b.day_of_week || 0,
    start_time: b.start_time || "00:00",
    end_time: b.end_time || "00:00",
  }));
}

/**
 * 학생의 활성 블록 세트를 조회합니다.
 *
 * 학생의 `active_block_set_id`를 확인한 후, 해당 블록 세트의 블록 스케줄을 조회합니다.
 * 관리자/컨설턴트가 다른 학생 데이터를 조회하는 경우 Admin 클라이언트를 사용합니다.
 *
 * @param studentId 학생 ID
 * @param currentUserId 현재 사용자 ID
 * @param role 현재 사용자 역할
 * @returns 블록 정보 배열 또는 null (활성 블록 세트가 없거나 조회 실패 시)
 */
async function getActiveBlockSet(
  studentId: string,
  currentUserId: string,
  role: PlanGroupAllowedRole
): Promise<BlockInfo[] | null> {
  // 적절한 클라이언트 선택
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const queryClient = await selectClientForCrossAccess(
    studentId,
    currentUserId,
    isAdminOrConsultant
  );

  if (!queryClient) {
    throw new Error("데이터베이스 클라이언트를 초기화할 수 없습니다.");
  }

  // 학생의 활성 블록 세트 ID 조회
  const { data: student } = await queryClient
    .from("students")
    .select("active_block_set_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student?.active_block_set_id) {
    return null;
  }

  // 활성 블록 세트의 블록 조회
  const { data: blockRows, error: blocksError } = await queryClient
    .from("student_block_schedule")
    .select("day_of_week, start_time, end_time")
    .eq("block_set_id", student.active_block_set_id)
    .eq("student_id", studentId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (blocksError) {
    logError(blocksError, {
      function: "getActiveBlockSet",
      studentId,
      activeBlockSetId: student.active_block_set_id,
    });
    // DB 에러는 throw하여 호출자가 캐시 미스와 구분할 수 있도록 함
    throw new Error(`활성 블록 세트 조회 실패: ${blocksError.message}`);
  }

  // 블록이 없는 경우 (정상적인 캐시 미스) - null 반환
  if (!blockRows || blockRows.length === 0) {
    return null;
  }

  return blockRows.map((b) => ({
    day_of_week: b.day_of_week || 0,
    start_time: b.start_time || "00:00",
    end_time: b.end_time || "00:00",
  }));
}

/**
 * 블록 세트 조회 실패 시 사용자에게 표시할 에러 메시지를 생성합니다.
 *
 * 플랜 그룹의 타입(캠프 모드/일반 모드)에 따라 적절한 에러 메시지를 반환합니다.
 *
 * @param group 플랜 그룹 객체
 * @param hasBlocks 블록이 존재하는지 여부 (현재는 사용되지 않음)
 * @returns 사용자에게 표시할 에러 메시지
 */
export function getBlockSetErrorMessage(
  group: PlanGroup,
  hasBlocks: boolean
): string {
  if (isCampMode(group)) {
    return hasBlocks
      ? "템플릿 블록 세트가 설정되지 않았거나, 템플릿 블록이 없습니다. 관리자에게 문의해주세요."
      : "템플릿 블록 세트가 설정되지 않았거나, 템플릿 블록이 없습니다. 관리자에게 문의해주세요.";
  }

  return hasBlocks
    ? "블록 세트가 설정되지 않았거나, 활성 블록 세트에 등록된 블록이 없습니다. 블록 세트를 설정하고 블록을 추가해주세요."
    : "블록 세트가 설정되지 않았거나, 활성 블록 세트에 등록된 블록이 없습니다. 블록 세트를 설정하고 블록을 추가해주세요.";
}


