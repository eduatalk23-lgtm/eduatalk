"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AppError, ErrorCode, withErrorHandling } from "@/lib/errors";
import { blockSchema, validateFormData } from "@/lib/validation/schemas";
import { checkBlockOverlap } from "@/lib/blocks/validation";
import {
  createBlock,
  updateBlock,
  deleteBlock,
  getBlockById,
  getBlocksBySetId,
  getBlockSetById,
  createBlockSet,
  fetchBlockSetsWithBlocks,
} from "@/lib/data/blockSets";
import { getStudentById, type Student } from "@/lib/data/students";

async function _addBlock(formData: FormData): Promise<void> {
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

  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // 활성 블록 세트 조회
  const student = await getStudentById(user.userId, user.tenantId);
  if (!student) {
    throw new AppError("학생 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const studentWithActiveSet = student as Student & { active_block_set_id?: string | null };

  // block_set_id가 제공되면 해당 세트 사용, 없으면 활성 세트 사용
  let activeSetId: string | null = null;
  
  if (blockSetId && typeof blockSetId === "string") {
    // 제공된 block_set_id가 사용자의 세트인지 확인
    const providedSet = await getBlockSetById(blockSetId, user.userId);
    if (!providedSet) {
      throw new AppError(
        "블록 세트를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }
    activeSetId = providedSet.id;
  } else {
    // 활성 세트가 없으면 기본 세트 생성 또는 조회
    activeSetId = studentWithActiveSet.active_block_set_id ?? null;
    if (!activeSetId) {
      // 기본 세트 찾기 또는 생성
      const allSets = await fetchBlockSetsWithBlocks(user.userId);
      const defaultSet = allSets.find((set) => set.name === "기본");

      if (defaultSet) {
        activeSetId = defaultSet.id;
        // 활성 세트로 설정
        const supabase = await createSupabaseServerClient();
        await supabase
          .from("students")
          .update({ active_block_set_id: defaultSet.id })
          .eq("id", user.userId);
      } else {
        // 기본 세트 생성
        const createResult = await createBlockSet({
          tenant_id: student.tenant_id,
          student_id: user.userId,
          name: "기본",
          description: "기본 시간 블록 세트",
          display_order: 0,
        });

        if (!createResult.success || !createResult.blockSetId) {
          throw new AppError(
            createResult.error || "기본 블록 세트 생성 중 오류가 발생했습니다.",
            ErrorCode.DATABASE_ERROR,
            500,
            true
          );
        }

        activeSetId = createResult.blockSetId;
        const supabase = await createSupabaseServerClient();
        await supabase
          .from("students")
          .update({ active_block_set_id: createResult.blockSetId })
          .eq("id", user.userId);
      }
    }
  }

  if (!activeSetId) {
    throw new AppError("블록 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 겹침 검증 (같은 세트 내에서만)
  const existingBlocks = await getBlocksBySetId(activeSetId, user.userId, day);
  if (existingBlocks.length > 0) {
    const hasOverlap = checkBlockOverlap(
      { startTime, endTime },
      existingBlocks.map((b) => ({
        startTime: b.start_time,
        endTime: b.end_time,
      }))
    );

    if (hasOverlap) {
      throw new AppError(
        "이미 등록된 시간 블록과 겹칩니다. 다른 시간대를 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  }

  // lib/data/blockSets.ts의 createBlock 사용
  const result = await createBlock({
    tenant_id: student.tenant_id,
    student_id: user.userId,
    block_set_id: activeSetId,
    day_of_week: day,
    start_time: startTime,
    end_time: endTime,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "시간 블록 추가 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
}

async function _updateBlock(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const blockId = formData.get("id");
  if (!blockId || typeof blockId !== "string") {
    throw new AppError("블록 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

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

  // 기존 블록 확인 (소유권 검증)
  const existingBlock = await getBlockById(blockId, user.userId);
  if (!existingBlock) {
    throw new AppError("블록을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 블록이 속한 원래 세트 ID 사용 (활성 세트가 아님)
  const blockSetId = existingBlock.block_set_id;
  if (!blockSetId) {
    throw new AppError("블록이 속한 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 겹침 검증 (같은 세트 내에서, 자기 자신 제외)
  const allBlocks = await getBlocksBySetId(blockSetId, user.userId, day);
  const otherBlocks = allBlocks.filter((b) => b.id !== blockId);

  if (otherBlocks.length > 0) {
    const hasOverlap = checkBlockOverlap(
      { startTime, endTime },
      otherBlocks.map((b) => ({
        startTime: b.start_time,
        endTime: b.end_time,
      }))
    );

    if (hasOverlap) {
      throw new AppError(
        "이미 등록된 시간 블록과 겹칩니다. 다른 시간대를 선택해주세요.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  }

  // lib/data/blockSets.ts의 updateBlock 사용
  const result = await updateBlock(blockId, user.userId, {
    day_of_week: day,
    start_time: startTime,
    end_time: endTime,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "시간 블록 수정 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
}

async function _deleteBlock(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const blockId = formData.get("id");
  if (!blockId || typeof blockId !== "string") {
    throw new AppError("블록 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // lib/data/blockSets.ts의 deleteBlock 사용
  const result = await deleteBlock(blockId, user.userId);

  if (!result.success) {
    throw new AppError(
      result.error || "시간 블록 삭제 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
}

async function _duplicateBlock(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  const blockId = formData.get("id");
  const targetDay = formData.get("target_day");

  if (!blockId || typeof blockId !== "string") {
    throw new AppError("블록 ID가 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!targetDay || typeof targetDay !== "string") {
    throw new AppError("대상 요일이 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const targetDayNum = Number(targetDay);
  if (isNaN(targetDayNum) || targetDayNum < 0 || targetDayNum > 6) {
    throw new AppError("올바른 요일을 선택해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  // 원본 블록 조회
  const sourceBlock = await getBlockById(blockId, user.userId);
  if (!sourceBlock || !sourceBlock.start_time || !sourceBlock.end_time) {
    throw new AppError("블록을 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 활성 블록 세트 조회
  const student = await getStudentById(user.userId, user.tenantId);
  if (!student) {
    throw new AppError("학생 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  const studentWithActiveSet = student as Student & { active_block_set_id?: string | null };
  const activeSetId = studentWithActiveSet.active_block_set_id ?? sourceBlock.block_set_id;
  if (!activeSetId) {
    throw new AppError("블록 세트를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // 대상 요일의 겹침 검증 (같은 세트 내에서만)
  const existingBlocks = await getBlocksBySetId(activeSetId, user.userId, targetDayNum);
  if (existingBlocks.length > 0) {
    const hasOverlap = checkBlockOverlap(
      { startTime: sourceBlock.start_time, endTime: sourceBlock.end_time },
      existingBlocks.map((b) => ({
        startTime: b.start_time,
        endTime: b.end_time,
      }))
    );

    if (hasOverlap) {
      throw new AppError(
        "대상 요일에 이미 등록된 시간 블록과 겹칩니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
    }
  }

  // lib/data/blockSets.ts의 createBlock 사용
  const result = await createBlock({
    tenant_id: student.tenant_id,
    student_id: user.userId,
    block_set_id: activeSetId,
    day_of_week: targetDayNum,
    start_time: sourceBlock.start_time,
    end_time: sourceBlock.end_time,
  });

  if (!result.success) {
    throw new AppError(
      result.error || "시간 블록 복제 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  revalidatePath("/blocks");
}

async function _addBlocksToMultipleDays(formData: FormData): Promise<void> {
  const targetDays = formData.get("target_days"); // "1,2,3,4,5" 형식
  const startTime = formData.get("start_time");
  const endTime = formData.get("end_time");
  const blockSetId = formData.get("block_set_id"); // 특정 세트에 추가하는 경우

  if (!targetDays || typeof targetDays !== "string") {
    throw new AppError("대상 요일이 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!startTime || typeof startTime !== "string") {
    throw new AppError("시작 시간이 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  if (!endTime || typeof endTime !== "string") {
    throw new AppError("종료 시간이 필요합니다.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const targetDayNums = targetDays
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => !isNaN(d) && d >= 0 && d <= 6);

  if (targetDayNums.length === 0) {
    throw new AppError("추가할 요일을 최소 1개 이상 선택해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }

  // 활성 블록 세트 조회
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("active_block_set_id, tenant_id")
    .eq("id", user.id)
    .single();

  if (studentError) {
    throw new AppError(
      studentError.message || "학생 정보를 조회하는 중 오류가 발생했습니다.",
      ErrorCode.DATABASE_ERROR,
      500,
      true,
      { supabaseError: studentError }
    );
  }

  if (!student) {
    throw new AppError("학생 정보를 찾을 수 없습니다.", ErrorCode.NOT_FOUND, 404, true);
  }

  // block_set_id가 제공되면 해당 세트 사용, 없으면 활성 세트 사용
  let activeSetId: string | null = null;
  
  if (blockSetId && typeof blockSetId === "string") {
    // 제공된 block_set_id가 사용자의 세트인지 확인
    const { data: providedSet, error: setError } = await supabase
      .from("student_block_sets")
      .select("id")
      .eq("id", blockSetId)
      .eq("student_id", user.id)
      .single();

    if (setError || !providedSet) {
      throw new AppError(
        "블록 세트를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }
    activeSetId = providedSet.id;
  } else {
    activeSetId = student.active_block_set_id;
    
    if (!activeSetId) {
      throw new AppError("활성 블록 세트가 없습니다. 먼저 블록 세트를 생성해주세요.", ErrorCode.VALIDATION_ERROR, 400, true);
    }
  }

  // 각 대상 요일로 블록 추가 (겹치는 블록은 스킵하고 나머지만 추가)
  const insertPromises = targetDayNums.map(async (targetDay) => {
    // 대상 요일의 기존 블록 조회 (같은 세트 내에서만)
    const { data: existingBlocks } = await supabase
      .from("student_block_schedule")
      .select("start_time, end_time")
      .eq("student_id", user.id)
      .eq("day_of_week", targetDay)
      .eq("block_set_id", activeSetId);

    // 겹침 검증
    const existingBlocksArray = existingBlocks || [];
    const hasOverlap = existingBlocksArray.length > 0 && checkBlockOverlap(
      { startTime, endTime },
      existingBlocksArray.map((b) => ({
        startTime: b.start_time ?? "",
        endTime: b.end_time ?? "",
      }))
    );

    if (hasOverlap) {
      return { 
        targetDay, 
        skipped: true, 
        reason: "이미 등록된 시간 블록과 겹칩니다"
      };
    }

    // 블록 삽입
    const { error } = await supabase.from("student_block_schedule").insert({
      tenant_id: student.tenant_id,
      student_id: user.id,
      block_set_id: activeSetId,
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

  revalidatePath("/blocks");

  // 부분 성공인 경우 상세 정보 제공 (성공으로 처리하되 정보 메시지 전달)
  if (skippedResults.length > 0) {
    const successDays = successResults.map((r) => ["일", "월", "화", "수", "목", "금", "토"][r.targetDay]).join(", ");
    const skippedDays = skippedResults.map((r) => ["일", "월", "화", "수", "목", "금", "토"][r.targetDay]).join(", ");
    
    // 부분 성공 정보를 포함한 정보성 메시지 (성공으로 처리)
    const infoMessage = `${successDays}요일에 블록이 추가되었습니다. ${skippedDays}요일은 겹치는 시간대가 있어 스킵되었습니다.`;
    
    // 정보 메시지를 포함한 에러로 전달 (클라이언트에서 성공 메시지로 표시)
    throw new AppError(
      `INFO: ${infoMessage}`,
      ErrorCode.BUSINESS_LOGIC_ERROR,
      200,
      true
    );
  }
}

// 에러 핸들링 래퍼 적용
export const addBlock = withErrorHandling(_addBlock);
export const updateBlock = withErrorHandling(_updateBlock);
export const deleteBlock = withErrorHandling(_deleteBlock);
export const duplicateBlock = withErrorHandling(_duplicateBlock);
export const addBlocksToMultipleDays = withErrorHandling(_addBlocksToMultipleDays);
