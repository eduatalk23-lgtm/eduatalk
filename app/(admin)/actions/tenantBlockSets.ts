"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { blockSchema, validateFormData } from "@/lib/validation/schemas";

/**
 * 테넌트 블록 세트 생성
 */
async function _createTenantBlockSet(formData: FormData): Promise<{ blockSetId: string; name: string }> {
  // 권한 확인
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const name = formData.get("name");
  const description = formData.get("description");

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new AppError("세트 이름을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (name.length > 100) {
    throw new AppError("세트 이름은 100자 이하여야 합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();

  // 중복 이름 확인 (tenant_id 기준)
  const { data: existingSet } = await supabase
    .from("tenant_block_sets")
    .select("id")
    .eq("name", name.trim())
    .eq("tenant_id", tenantContext.tenantId)
    .maybeSingle();

  if (existingSet) {
    throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const { data: newSet, error } = await supabase
    .from("tenant_block_sets")
    .insert({
      tenant_id: tenantContext.tenantId,
      name: name.trim(),
      description: description && typeof description === "string" ? description.trim() : null,
    })
    .select("id, name")
    .single();

  if (error) {
    throw new AppError(
      "블록 세트 생성에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  if (!newSet) {
    throw new AppError("블록 세트 생성에 실패했습니다.", ErrorCode.INTERNAL_ERROR, 500, true);
  }

  revalidatePath("/admin/time-management");
  return { blockSetId: newSet.id, name: newSet.name };
}

/**
 * 테넌트 블록 세트 수정
 */
async function _updateTenantBlockSet(formData: FormData): Promise<void> {
  // 권한 확인
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const setId = formData.get("id");
  const name = formData.get("name");
  const description = formData.get("description");

  if (!setId || typeof setId !== "string") {
    throw new AppError("세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new AppError("세트 이름을 입력해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (name.length > 100) {
    throw new AppError("세트 이름은 100자 이하여야 합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new AppError("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.", ErrorCode.INTERNAL_ERROR, 500, true);
  }

  // 세트 존재 및 권한 확인
  const { data: existingSet } = await supabase
    .from("tenant_block_sets")
    .select("id, name")
    .eq("id", setId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 이름 변경 시 중복 확인 (자기 자신 제외)
  if (existingSet.name !== name.trim()) {
    const { data: duplicateSet } = await supabase
      .from("tenant_block_sets")
      .select("id")
      .eq("tenant_id", tenantContext.tenantId)
      .eq("name", name.trim())
      .neq("id", setId)
      .maybeSingle();

    if (duplicateSet) {
      throw new AppError("이미 같은 이름의 세트가 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
    }
  }

  const { data: updatedRows, error } = await supabase
    .from("tenant_block_sets")
    .update({
      name: name.trim(),
      description: description && typeof description === "string" ? description.trim() : null,
    })
    .eq("id", setId)
    .eq("tenant_id", tenantContext.tenantId)
    .select();

  if (error) {
    throw new AppError(
      "블록 세트 수정에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  if (!updatedRows || updatedRows.length === 0) {
    throw new AppError("블록 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  revalidatePath("/admin/time-management");
}

/**
 * 테넌트 블록 세트 삭제
 */
async function _deleteTenantBlockSet(formData: FormData): Promise<void> {
  // 권한 확인
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const setId = formData.get("id");

  if (!setId || typeof setId !== "string") {
    throw new AppError("세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new AppError("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.", ErrorCode.INTERNAL_ERROR, 500, true);
  }

  // 세트 존재 및 권한 확인
  const { data: existingSet } = await supabase
    .from("tenant_block_sets")
    .select("id")
    .eq("id", setId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!existingSet) {
    throw new AppError("세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // CASCADE로 블록도 함께 삭제됨
  const { data: deletedRows, error } = await supabase
    .from("tenant_block_sets")
    .delete()
    .eq("id", setId)
    .eq("tenant_id", tenantContext.tenantId)
    .select();

  if (error) {
    throw new AppError(
      "블록 세트 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  if (!deletedRows || deletedRows.length === 0) {
    throw new AppError("블록 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  revalidatePath("/admin/time-management");
}

/**
 * 테넌트 블록 세트 목록 조회 (모든 테넌트 블록 세트)
 */
async function _getTenantBlockSets(): Promise<
  Array<{
    id: string;
    name: string;
    blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
  }>
> {
  // 권한 확인
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const supabase = await createSupabaseServerClient();

  // 모든 테넌트 블록 세트 조회
  const { data: blockSets, error: setsError } = await supabase
    .from("tenant_block_sets")
    .select("id, name")
    .eq("tenant_id", tenantContext.tenantId)
    .order("created_at", { ascending: true });

  if (setsError) {
    throw new AppError(
      "블록 세트 목록을 불러오는데 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: setsError.message }
    );
  }

  if (!blockSets || blockSets.length === 0) {
    return [];
  }

  // 각 블록 세트의 시간 블록 조회
  const blockSetsWithBlocks = await Promise.all(
    blockSets.map(async (set) => {
      const { data: blocks, error: blocksError } = await supabase
        .from("tenant_blocks")
        .select("id, day_of_week, start_time, end_time")
        .eq("tenant_block_set_id", set.id)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (blocksError) {
        console.error(`[tenantBlockSets] 블록 조회 실패 (세트 ${set.id}):`, blocksError);
        return { ...set, blocks: [] };
      }

      return {
        ...set,
        blocks:
          (blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>) ?? [],
      };
    })
  );

  return blockSetsWithBlocks;
}

/**
 * 테넌트 블록 추가
 */
async function _addTenantBlock(formData: FormData): Promise<void> {
  // 권한 확인
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 입력 검증
  const validation = validateFormData(formData, blockSchema);
  if (!validation.success) {
    const firstError = validation.errors.issues[0];
    throw new AppError(
      firstError?.message || "입력값이 올바르지 않습니다.",
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  const { day, start_time: startTime, end_time: endTime } = validation.data;
  const blockSetId = formData.get("block_set_id");

  if (!blockSetId || typeof blockSetId !== "string") {
    throw new AppError("블록 세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();

  // 블록 세트 존재 및 권한 확인
  const { data: blockSet } = await supabase
    .from("tenant_block_sets")
    .select("id")
    .eq("id", blockSetId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!blockSet) {
    throw new AppError("블록 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 중복 블록 확인
  const { data: existingBlock } = await supabase
    .from("tenant_blocks")
    .select("id")
    .eq("tenant_block_set_id", blockSetId)
    .eq("day_of_week", day)
    .eq("start_time", startTime)
    .eq("end_time", endTime)
    .maybeSingle();

  if (existingBlock) {
    throw new AppError("이미 같은 시간 블록이 있습니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const { error } = await supabase.from("tenant_blocks").insert({
    tenant_block_set_id: blockSetId,
    day_of_week: day,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) {
    throw new AppError(
      "블록 추가에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  revalidatePath("/admin/time-management");
}

/**
 * 테넌트 블록 일괄 추가 (여러 요일에 동일 시간대 블록 추가)
 */
async function _addTenantBlocksToMultipleDays(formData: FormData): Promise<void> {
  // 권한 확인
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const targetDays = formData.get("target_days"); // "1,2,3,4,5" 형식
  const startTime = formData.get("start_time");
  const endTime = formData.get("end_time");
  const blockSetId = formData.get("block_set_id");

  if (!targetDays || typeof targetDays !== "string") {
    throw new AppError("대상 요일이 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!startTime || typeof startTime !== "string") {
    throw new AppError("시작 시간이 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!endTime || typeof endTime !== "string") {
    throw new AppError("종료 시간이 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!blockSetId || typeof blockSetId !== "string") {
    throw new AppError("블록 세트 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const targetDayNums = targetDays
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => !isNaN(d) && d >= 0 && d <= 6);

  if (targetDayNums.length === 0) {
    throw new AppError("추가할 요일을 최소 1개 이상 선택해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();

  // 블록 세트 존재 및 권한 확인
  const { data: blockSet } = await supabase
    .from("tenant_block_sets")
    .select("id")
    .eq("id", blockSetId)
    .eq("tenant_id", tenantContext.tenantId)
    .single();

  if (!blockSet) {
    throw new AppError("블록 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 각 대상 요일로 블록 추가 (겹치는 블록은 스킵하고 나머지만 추가)
  const insertPromises = targetDayNums.map(async (targetDay) => {
    // 대상 요일의 기존 블록 조회
    const { data: existingBlock } = await supabase
      .from("tenant_blocks")
      .select("id")
      .eq("tenant_block_set_id", blockSetId)
      .eq("day_of_week", targetDay)
      .eq("start_time", startTime)
      .eq("end_time", endTime)
      .maybeSingle();

    if (existingBlock) {
      return { 
        targetDay, 
        skipped: true, 
        reason: "이미 같은 시간 블록이 있습니다"
      };
    }

    // 블록 삽입
    const { error } = await supabase.from("tenant_blocks").insert({
      tenant_block_set_id: blockSetId,
      day_of_week: targetDay,
      start_time: startTime,
      end_time: endTime,
    });

    if (error) {
      return { 
        targetDay, 
        skipped: true, 
        reason: error.message || "블록 추가 중 오류가 발생했습니다"
      };
    }

    return { 
      targetDay, 
      skipped: false
    };
  });

  const results = await Promise.all(insertPromises);
  const successResults = results.filter((r) => !r.skipped);
  const skippedResults = results.filter((r) => r.skipped);

  // 부분 성공도 허용하되, 상세한 피드백 제공
  if (successResults.length === 0) {
    // 모든 요일이 실패한 경우
    const skippedDays = skippedResults.map((r) => ["일", "월", "화", "수", "목", "금", "토"][r.targetDay]).join(", ");
    const reasons = skippedResults.map((r) => r.reason).filter(Boolean).join("; ");
    throw new AppError(
      `모든 요일(${skippedDays})로의 추가가 실패했습니다. ${reasons}`,
      ErrorCode.VALIDATION_ERROR,
      400,
      true
    );
  }

  revalidatePath("/admin/time-management");

  // 부분 성공인 경우 상세 정보 제공 (성공으로 처리하되 정보 메시지 전달)
  if (skippedResults.length > 0) {
    const successDays = successResults.map((r) => ["일", "월", "화", "수", "목", "금", "토"][r.targetDay]).join(", ");
    const skippedDays = skippedResults.map((r) => ["일", "월", "화", "수", "목", "금", "토"][r.targetDay]).join(", ");
    
    // 부분 성공 정보를 포함한 정보성 메시지 (성공으로 처리)
    const infoMessage = `${successDays}요일에 블록이 추가되었습니다. ${skippedDays}요일은 이미 같은 시간 블록이 있어 스킵되었습니다.`;
    
    // 정보 메시지를 포함한 에러로 전달 (클라이언트에서 성공 메시지로 표시)
    throw new AppError(
      `INFO: ${infoMessage}`,
      ErrorCode.BUSINESS_LOGIC_ERROR,
      200,
      true
    );
  }
}

/**
 * 테넌트 블록 삭제
 */
async function _deleteTenantBlock(formData: FormData): Promise<void> {
  // 권한 확인
  await requireAdminOrConsultant();

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    throw new AppError("기관 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const blockId = formData.get("id");

  if (!blockId || typeof blockId !== "string") {
    throw new AppError("블록 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // Admin Client 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new AppError("관리자 권한이 필요합니다. Service Role Key가 설정되지 않았습니다.", ErrorCode.INTERNAL_ERROR, 500, true);
  }

  // 블록 존재 확인
  const { data: block } = await supabase
    .from("tenant_blocks")
    .select("id, tenant_block_set_id")
    .eq("id", blockId)
    .single();

  if (!block) {
    throw new AppError("블록을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 블록 세트 존재 및 권한 확인
  const { data: blockSet } = await supabase
    .from("tenant_block_sets")
    .select("tenant_id")
    .eq("id", block.tenant_block_set_id)
    .single();

  if (!blockSet) {
    throw new AppError("블록 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  if (blockSet.tenant_id !== tenantContext.tenantId) {
    throw new AppError("권한이 없습니다.", ErrorCode.FORBIDDEN, 403, true);
  }

  const { data: deletedRows, error } = await supabase
    .from("tenant_blocks")
    .delete()
    .eq("id", blockId)
    .select();

  if (error) {
    throw new AppError(
      "블록 삭제에 실패했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { originalError: error.message }
    );
  }

  if (!deletedRows || deletedRows.length === 0) {
    throw new AppError("블록을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  revalidatePath("/admin/time-management");
}

// 에러 핸들링 래퍼 적용
export const createTenantBlockSet = withErrorHandling(_createTenantBlockSet);
export const updateTenantBlockSet = withErrorHandling(_updateTenantBlockSet);
export const deleteTenantBlockSet = withErrorHandling(_deleteTenantBlockSet);
export const getTenantBlockSets = withErrorHandling(_getTenantBlockSets);
export const addTenantBlock = withErrorHandling(_addTenantBlock);
export const addTenantBlocksToMultipleDays = withErrorHandling(_addTenantBlocksToMultipleDays);
export const deleteTenantBlock = withErrorHandling(_deleteTenantBlock);

