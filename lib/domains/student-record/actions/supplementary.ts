"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import * as service from "../service";
import type { SupplementaryTabData } from "../service";
import type {
  RecordApplicationInsert,
  RecordApplicationUpdate,
  RecordAwardInsert,
  RecordVolunteerInsert,
  RecordDisciplinaryInsert,
} from "../types";

const LOG_CTX = { domain: "student-record", action: "" };

// ============================================
// 보조 기록 탭 데이터 조회
// ============================================

export async function fetchSupplementaryTabData(
  studentId: string,
  schoolYear: number,
): Promise<ActionResponse<SupplementaryTabData>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const data = await service.getSupplementaryTabData(studentId, schoolYear, tenantId!);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchSupplementaryTabData" }, error, { studentId });
    return createErrorResponse("보조 기록 데이터를 불러오는 중 오류가 발생했습니다.");
  }
}

// ============================================
// 지원현황 CRUD
// ============================================

export async function addApplicationAction(
  input: RecordApplicationInsert,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.addApplication(input);
    if (!result.success) return createErrorResponse(result.error ?? "지원 추가 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addApplicationAction" }, error);
    return createErrorResponse("지원 추가 중 오류가 발생했습니다.");
  }
}

export async function updateApplicationAction(
  id: string,
  updates: RecordApplicationUpdate,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.updateApplication(id, updates);
    if (!result.success) return createErrorResponse(result.error ?? "지원 수정 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateApplicationAction" }, error);
    return createErrorResponse("지원 수정 중 오류가 발생했습니다.");
  }
}

export async function removeApplicationAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removeApplication(id);
    if (!result.success) return createErrorResponse(result.error ?? "지원 삭제 실패");
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeApplicationAction" }, error);
    return createErrorResponse("지원 삭제 중 오류가 발생했습니다.");
  }
}

// ============================================
// 수상/봉사/징계 CRUD
// ============================================

export async function addAwardAction(
  input: RecordAwardInsert,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.addAward(input);
    if (!result.success) return createErrorResponse(result.error ?? "수상 추가 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addAwardAction" }, error);
    return createErrorResponse("수상 추가 중 오류가 발생했습니다.");
  }
}

export async function removeAwardAction(id: string): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removeAward(id);
    if (!result.success) return createErrorResponse(result.error ?? "수상 삭제 실패");
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeAwardAction" }, error);
    return createErrorResponse("수상 삭제 중 오류가 발생했습니다.");
  }
}

export async function addVolunteerAction(
  input: RecordVolunteerInsert,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.addVolunteer(input);
    if (!result.success) return createErrorResponse(result.error ?? "봉사 추가 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addVolunteerAction" }, error);
    return createErrorResponse("봉사 추가 중 오류가 발생했습니다.");
  }
}

export async function removeVolunteerAction(id: string): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removeVolunteer(id);
    if (!result.success) return createErrorResponse(result.error ?? "봉사 삭제 실패");
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeVolunteerAction" }, error);
    return createErrorResponse("봉사 삭제 중 오류가 발생했습니다.");
  }
}

export async function addDisciplinaryAction(
  input: RecordDisciplinaryInsert,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.addDisciplinary(input);
    if (!result.success) return createErrorResponse(result.error ?? "징계 추가 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addDisciplinaryAction" }, error);
    return createErrorResponse("징계 추가 중 오류가 발생했습니다.");
  }
}

export async function removeDisciplinaryAction(id: string): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removeDisciplinary(id);
    if (!result.success) return createErrorResponse(result.error ?? "징계 삭제 실패");
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeDisciplinaryAction" }, error);
    return createErrorResponse("징계 삭제 중 오류가 발생했습니다.");
  }
}
