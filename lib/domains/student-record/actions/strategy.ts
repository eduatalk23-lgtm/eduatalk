"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import * as service from "../service";
import type {
  StrategyTabData,
  MinScoreTargetInsert,
  MinScoreTargetUpdate,
  MinScoreSimulationInsert,
  MinScoreCriteria,
} from "../types";

const LOG_CTX = { domain: "student-record", action: "" };

// ============================================
// 전략 탭 데이터 조회
// ============================================

export async function fetchStrategyTabData(
  studentId: string,
  schoolYear: number,
): Promise<ActionResponse<StrategyTabData>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const data = await service.getStrategyTabData(studentId, schoolYear, tenantId!);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchStrategyTabData" }, error, { studentId });
    return createErrorResponse("전략 데이터를 불러오는 중 오류가 발생했습니다.");
  }
}

// ============================================
// 수능최저 목표 CRUD
// ============================================

export async function addMinScoreTargetAction(
  input: MinScoreTargetInsert,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.addMinScoreTarget(input);
    if (!result.success) return createErrorResponse(result.error ?? "추가 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addMinScoreTargetAction" }, error);
    return createErrorResponse("최저 목표 추가 중 오류가 발생했습니다.");
  }
}

export async function updateMinScoreTargetAction(
  id: string,
  updates: MinScoreTargetUpdate,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.updateMinScoreTarget(id, updates);
    if (!result.success) return createErrorResponse(result.error ?? "수정 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateMinScoreTargetAction" }, error);
    return createErrorResponse("최저 목표 수정 중 오류가 발생했습니다.");
  }
}

export async function removeMinScoreTargetAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removeMinScoreTarget(id);
    if (!result.success) return createErrorResponse(result.error ?? "삭제 실패");
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeMinScoreTargetAction" }, error);
    return createErrorResponse("최저 목표 삭제 중 오류가 발생했습니다.");
  }
}

// ============================================
// 시뮬레이션 실행/삭제
// ============================================

export async function runMinScoreSimulationAction(
  input: Omit<MinScoreSimulationInsert, "is_met" | "grade_sum" | "gap" | "bottleneck_subjects" | "what_if">,
  criteria: MinScoreCriteria,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.runMinScoreSimulation(input, criteria);
    if (!result.success) return createErrorResponse(result.error ?? "시뮬레이션 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runMinScoreSimulationAction" }, error);
    return createErrorResponse("시뮬레이션 실행 중 오류가 발생했습니다.");
  }
}

export async function removeMinScoreSimulationAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removeMinScoreSimulation(id);
    if (!result.success) return createErrorResponse(result.error ?? "삭제 실패");
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeMinScoreSimulationAction" }, error);
    return createErrorResponse("시뮬레이션 삭제 중 오류가 발생했습니다.");
  }
}
