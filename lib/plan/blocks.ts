import type { PlanGroup } from "@/lib/types/plan";
import type { SupabaseClientForStudentQuery } from "@/lib/supabase/clientSelector";
import { selectClientForBlockSetQuery } from "@/lib/supabase/clientSelector";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanGroupAllowedRole } from "@/lib/auth/planGroupAuth";
import { PlanGroupError, PlanGroupErrorCodes, ErrorUserMessages } from "@/lib/errors/planGroupErrors";
import { logError } from "@/lib/errors/handler";
import { getCampTemplate } from "@/lib/data/campTemplates";

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
 * - 캠프 모드: 템플릿 블록 세트 조회 (연결 테이블 → 하위 호환성 → template_data)
 * - 일반 모드: 학생 블록 세트 조회 (block_set_id → active_block_set_id)
 *
 * @param group 플랜 그룹
 * @param studentId 학생 ID
 * @param currentUserId 현재 사용자 ID
 * @param role 현재 사용자 역할
 * @param tenantId 테넌트 ID (캠프 모드에서 필요)
 * @returns 블록 정보 배열
 */
export async function getBlockSetForPlanGroup(
  group: PlanGroup,
  studentId: string,
  currentUserId: string,
  role: PlanGroupAllowedRole,
  tenantId?: string | null
): Promise<BlockInfo[]> {
  let baseBlocks: BlockInfo[] = [];

  // 캠프 모드: 템플릿 블록 세트 조회
  if (group.plan_type === "camp" && group.camp_template_id) {
    const templateBlocks = await getTemplateBlockSet(
      group.camp_template_id,
      tenantId
    );
    if (templateBlocks && templateBlocks.length > 0) {
      baseBlocks = templateBlocks;
    }
  }

  // 일반 모드: 학생 블록 세트 조회
  if (baseBlocks.length === 0 && group.block_set_id) {
    const studentBlocks = await getStudentBlockSet(
      group.block_set_id,
      studentId,
      currentUserId,
      role
    );
    if (studentBlocks && studentBlocks.length > 0) {
      baseBlocks = studentBlocks;
    }
  }

  // 기본 블록 세트 사용 (캠프 모드가 아닐 때만)
  if (baseBlocks.length === 0 && group.plan_type !== "camp") {
    const activeBlocks = await getActiveBlockSet(
      studentId,
      currentUserId,
      role
    );
    if (activeBlocks && activeBlocks.length > 0) {
      baseBlocks = activeBlocks;
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
    };
    
    // 캠프 모드에서 블록 세트가 필수인 경우 에러 throw
    if (group.plan_type === "camp") {
      const error = new PlanGroupError(
        `캠프 템플릿(${group.camp_template_id})에 연결된 블록 세트를 찾을 수 없습니다.`,
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
    logError(
      new Error("블록 세트가 없어 빈 배열을 반환합니다."),
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
 * 연결 테이블 → 하위 호환성 → template_data 순으로 조회합니다.
 */
async function getTemplateBlockSet(
  templateId: string,
  tenantId?: string | null
): Promise<BlockInfo[] | null> {
  const supabase = await createSupabaseServerClient();

  // 1. 연결 테이블에서 템플릿에 연결된 블록 세트 조회
  const { data: templateBlockSetLink } = await supabase
    .from("camp_template_block_sets")
    .select("tenant_block_set_id")
    .eq("camp_template_id", templateId)
    .maybeSingle();

  let templateBlockSetId: string | null = null;
  if (templateBlockSetLink) {
    templateBlockSetId = templateBlockSetLink.tenant_block_set_id;
  } else {
    // 2. 하위 호환성: template_data.block_set_id 확인 (마이그레이션 전 데이터용)
    const template = await getCampTemplate(templateId);
    if (template?.template_data?.block_set_id) {
      templateBlockSetId = template.template_data.block_set_id;
    }
  }

  if (!templateBlockSetId) {
    return null;
  }

  // 3. tenant_blocks에서 블록 조회
  const { data: blockRows, error: blocksError } = await supabase
    .from("tenant_blocks")
    .select("day_of_week, start_time, end_time")
    .eq("tenant_block_set_id", templateBlockSetId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (blocksError) {
    const errorContext = {
      templateId,
      templateBlockSetId,
      error: blocksError.message,
      code: blocksError.code,
      details: blocksError.details,
      hint: blocksError.hint,
    };
    logError(blocksError, {
      function: "getTemplateBlockSet",
      ...errorContext,
    });
    // 블록 조회 실패는 null 반환 (상위에서 처리)
    return null;
  }

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
 * 템플릿 블록 세트 ID를 조회합니다.
 * 연결 테이블 → scheduler_options → template_data 순서로 조회합니다.
 *
 * @param templateId 캠프 템플릿 ID
 * @param schedulerOptions scheduler_options 객체 (Fallback용, 선택사항)
 * @param tenantId 테넌트 ID (선택사항)
 * @returns tenant_block_set_id 또는 null
 */
export async function getTemplateBlockSetId(
  templateId: string,
  schedulerOptions?: Record<string, any> | null,
  tenantId?: string | null
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  // 1. 연결 테이블에서 직접 조회
  const { data: templateBlockSetLink, error: linkError } = await supabase
    .from("camp_template_block_sets")
    .select("tenant_block_set_id")
    .eq("camp_template_id", templateId)
    .maybeSingle();

  if (linkError) {
    logError(linkError, {
      function: "getTemplateBlockSetId",
      templateId,
      code: linkError.code,
      details: linkError.details,
      hint: linkError.hint,
      level: "warn", // 연결 테이블 조회 실패는 치명적이지 않을 수 있으므로 경고 레벨
    });
    // 연결 테이블 조회 실패는 치명적이지 않을 수 있으므로 fallback으로 진행
  } else if (templateBlockSetLink) {
    return templateBlockSetLink.tenant_block_set_id;
  }

  // 2. scheduler_options에서 template_block_set_id 확인 (Fallback)
  if (schedulerOptions?.template_block_set_id) {
    return schedulerOptions.template_block_set_id;
  }

  // 3. template_data에서 block_set_id 확인 (하위 호환성)
  const template = await getCampTemplate(templateId);
  if (template?.template_data) {
    try {
      let templateData: { block_set_id?: string } | null = null;
      if (typeof template.template_data === "string") {
        templateData = JSON.parse(template.template_data) as { block_set_id?: string };
      } else {
        templateData = template.template_data as { block_set_id?: string };
      }

      if (templateData?.block_set_id) {
        return templateData.block_set_id;
      }
    } catch (parseError) {
      logError(parseError, {
        function: "getTemplateBlockSetId",
        templateId,
        level: "warn", // 파싱 에러는 치명적이지 않으므로 경고 레벨
      });
      // 파싱 에러는 치명적이지 않으므로 null 반환
    }
  }

  // 모든 조회 방법이 실패한 경우 null 반환 (정상적인 경우일 수 있음)
  // 하지만 로깅은 강화
  logError(
    new Error("템플릿 블록 세트 ID를 찾을 수 없습니다."),
    {
      function: "getTemplateBlockSetId",
      templateId,
      tenantId,
      hasSchedulerOptions: !!schedulerOptions,
      level: "warn",
    }
  );
  
  return null;
}

/**
 * 학생 블록 세트를 조회합니다.
 */
async function getStudentBlockSet(
  blockSetId: string,
  studentId: string,
  currentUserId: string,
  role: PlanGroupAllowedRole
): Promise<BlockInfo[] | null> {
  // 적절한 클라이언트 선택 (관리자/컨설턴트가 다른 학생 데이터 조회 시 Admin 클라이언트)
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const queryClient = await selectClientForBlockSetQuery(
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
    return null;
  }

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
 */
async function getActiveBlockSet(
  studentId: string,
  currentUserId: string,
  role: PlanGroupAllowedRole
): Promise<BlockInfo[] | null> {
  // 적절한 클라이언트 선택
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const queryClient = await selectClientForBlockSetQuery(
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
    return null;
  }

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
 * 블록 세트 조회 실패 시 에러 메시지를 생성합니다.
 */
export function getBlockSetErrorMessage(
  group: PlanGroup,
  hasBlocks: boolean
): string {
  if (group.plan_type === "camp") {
    return hasBlocks
      ? "템플릿 블록 세트가 설정되지 않았거나, 템플릿 블록이 없습니다. 관리자에게 문의해주세요."
      : "템플릿 블록 세트가 설정되지 않았거나, 템플릿 블록이 없습니다. 관리자에게 문의해주세요.";
  }

  return hasBlocks
    ? "블록 세트가 설정되지 않았거나, 활성 블록 세트에 등록된 블록이 없습니다. 블록 세트를 설정하고 블록을 추가해주세요."
    : "블록 세트가 설정되지 않았거나, 활성 블록 세트에 등록된 블록이 없습니다. 블록 세트를 설정하고 블록을 추가해주세요.";
}


