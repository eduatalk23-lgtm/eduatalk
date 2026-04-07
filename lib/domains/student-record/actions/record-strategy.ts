"use server";

// ============================================
// 보완전략 CRUD Server Actions
// diagnosis.ts에서 분리 (M1 구조 개선)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import * as diagnosisRepo from "../repository/diagnosis-repository";
import type { StrategyInsert, StrategyUpdate, StudentRecordActionResult } from "../types";

const LOG_CTX = { domain: "student-record", action: "record-strategy" };

export async function addStrategyAction(
  input: StrategyInsert,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    const id = await diagnosisRepo.insertStrategy(input);
    return { success: true, id };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addStrategy" }, error);
    return { success: false, error: "보완전략 추가 중 오류가 발생했습니다." };
  }
}

export async function updateStrategyAction(
  id: string,
  updates: StrategyUpdate,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.updateStrategy(id, updates);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateStrategy" }, error);
    return { success: false, error: "보완전략 수정 중 오류가 발생했습니다." };
  }
}

export async function deleteStrategyAction(
  id: string,
): Promise<StudentRecordActionResult> {
  try {
    await requireAdminOrConsultant();
    await diagnosisRepo.deleteStrategy(id);
    return { success: true };
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "deleteStrategy" }, error);
    return { success: false, error: "보완전략 삭제 중 오류가 발생했습니다." };
  }
}
