"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import type {
  ActionResponse,
} from "@/lib/types/actionResponse";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import * as service from "../service";
import { markRelatedEdgesStale, markRelatedAssignmentsStale, autoMatchRoadmapOnSetekSave } from "../stale-detection";
import type {
  RecordTabData,
  RecordSetekInsert,
  RecordChangcheInsert,
  RecordHaengteukInsert,
  RecordReadingInsert,
  RecordAttendanceInsert,
  RecordPersonalSetekInsert,
} from "../types";

const LOG_CTX = { domain: "student-record", action: "" };

// ============================================
// 기록 탭 데이터 조회
// ============================================

export async function fetchRecordTabData(
  studentId: string,
  schoolYear: number,
): Promise<ActionResponse<RecordTabData>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const data = await service.getRecordTabData(studentId, schoolYear, tenantId!);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchRecordTabData" }, error, { studentId, schoolYear });
    return createErrorResponse("기록 데이터를 불러오는 중 오류가 발생했습니다.");
  }
}

// ============================================
// 세특 저장
// ============================================

export async function saveSetekAction(
  input: RecordSetekInsert,
  options?: { curriculumRevisionId?: string },
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.saveSetek(input, options);
    if (!result.success) {
      return createErrorResponse(result.error ?? "세특 저장 실패");
    }
    // Phase E3: 관련 엣지 stale 마킹 (fire-and-forget)
    markRelatedEdgesStale(result.id!).catch((err) => logActionWarn(LOG_CTX, `markRelatedEdgesStale failed: ${err instanceof Error ? err.message : String(err)}`));
    markRelatedAssignmentsStale(result.id!).catch((err) => logActionWarn(LOG_CTX, `markRelatedAssignmentsStale failed: ${err instanceof Error ? err.message : String(err)}`));
    // H2: 로드맵 자동 매칭 (세특 과목+학년 → roadmap status 전환)
    if (input.student_id && input.subject_id && input.grade) {
      autoMatchRoadmapOnSetekSave(input.student_id, input.subject_id, input.grade, input.content ?? "").catch((err) => logActionWarn(LOG_CTX, `autoMatchRoadmapOnSetekSave failed: ${err instanceof Error ? err.message : String(err)}`));
    }
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveSetekAction" }, error);
    return createErrorResponse("세특 저장 중 오류가 발생했습니다.");
  }
}

// ============================================
// 개인 세특 저장 (추가)
// ============================================

export async function savePersonalSetekAction(
  input: RecordPersonalSetekInsert,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.savePersonalSetek(input);
    if (!result.success) {
      return createErrorResponse(result.error ?? "개인 세특 저장 실패");
    }
    markRelatedEdgesStale(result.id!).catch((err) => logActionWarn(LOG_CTX, `markRelatedEdgesStale failed: ${err instanceof Error ? err.message : String(err)}`));
    markRelatedAssignmentsStale(result.id!).catch((err) => logActionWarn(LOG_CTX, `markRelatedAssignmentsStale failed: ${err instanceof Error ? err.message : String(err)}`));
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "savePersonalSetekAction" }, error);
    return createErrorResponse("개인 세특 저장 중 오류가 발생했습니다.");
  }
}

// ============================================
// 세특 삭제 (소프트 삭제)
// ============================================

export async function removeSetekAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removeSetek(id);
    if (!result.success) {
      return createErrorResponse(result.error ?? "세특 삭제 실패");
    }
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeSetekAction" }, error);
    return createErrorResponse("세특 삭제 중 오류가 발생했습니다.");
  }
}

// ============================================
// 개인 세특 삭제
// ============================================

export async function removePersonalSetekAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removePersonalSetek(id);
    if (!result.success) {
      return createErrorResponse(result.error ?? "개인 세특 삭제 실패");
    }
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removePersonalSetekAction" }, error);
    return createErrorResponse("개인 세특 삭제 중 오류가 발생했습니다.");
  }
}

// ============================================
// 창체 저장
// ============================================

export async function saveChangcheAction(
  input: RecordChangcheInsert,
  schoolYear: number,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.saveChangche(input, schoolYear);
    if (!result.success) {
      return createErrorResponse(result.error ?? "창체 저장 실패");
    }
    markRelatedEdgesStale(result.id!).catch((err) => logActionWarn(LOG_CTX, `markRelatedEdgesStale failed: ${err instanceof Error ? err.message : String(err)}`));
    markRelatedAssignmentsStale(result.id!).catch((err) => logActionWarn(LOG_CTX, `markRelatedAssignmentsStale failed: ${err instanceof Error ? err.message : String(err)}`));
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveChangcheAction" }, error);
    return createErrorResponse("창체 저장 중 오류가 발생했습니다.");
  }
}

// ============================================
// 행특 저장
// ============================================

export async function saveHaengteukAction(
  input: RecordHaengteukInsert,
  schoolYear: number,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.saveHaengteuk(input, schoolYear);
    if (!result.success) {
      return createErrorResponse(result.error ?? "행특 저장 실패");
    }
    markRelatedEdgesStale(result.id!).catch((err) => logActionWarn(LOG_CTX, `markRelatedEdgesStale failed: ${err instanceof Error ? err.message : String(err)}`));
    markRelatedAssignmentsStale(result.id!).catch((err) => logActionWarn(LOG_CTX, `markRelatedAssignmentsStale failed: ${err instanceof Error ? err.message : String(err)}`));
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveHaengteukAction" }, error);
    return createErrorResponse("행특 저장 중 오류가 발생했습니다.");
  }
}

// ============================================
// 독서 추가/삭제
// ============================================

export async function addReadingAction(
  input: RecordReadingInsert,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.addReading(input);
    if (!result.success) {
      return createErrorResponse(result.error ?? "독서 추가 실패");
    }
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addReadingAction" }, error);
    return createErrorResponse("독서 추가 중 오류가 발생했습니다.");
  }
}

export async function removeReadingAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removeReading(id);
    if (!result.success) {
      return createErrorResponse(result.error ?? "독서 삭제 실패");
    }
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeReadingAction" }, error);
    return createErrorResponse("독서 삭제 중 오류가 발생했습니다.");
  }
}

// ============================================
// 출결 저장
// ============================================

export async function saveAttendanceAction(
  input: RecordAttendanceInsert,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.saveAttendance(input);
    if (!result.success) {
      return createErrorResponse(result.error ?? "출결 저장 실패");
    }
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveAttendanceAction" }, error);
    return createErrorResponse("출결 저장 중 오류가 발생했습니다.");
  }
}
