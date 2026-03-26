"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import type {
  AssignmentWithGuide,
  ExplorationGuide,
  GuideDetail,
  GuideAssignment,
  CareerField,
  GuideListFilter,
  AssignmentStatus,
  LinkedRecordType,
} from "../types";
import {
  findAssignmentsWithGuides,
  findGuides,
  findGuideById,
  createAssignment,
  updateAssignmentStatus,
  deleteAssignment,
  getCompletionRate,
  findAllCareerFields,
} from "../repository";

const LOG_CTX = { domain: "guide", action: "assignment" };

/** 배정 목록 + 가이드 메타 */
export async function fetchAssignedGuidesAction(
  studentId: string,
  schoolYear?: number,
): Promise<ActionResponse<AssignmentWithGuide[]>> {
  try {
    await requireAdminOrConsultant();
    const data = await findAssignmentsWithGuides(studentId, schoolYear);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchAssignedGuides" }, error, { studentId });
    return createErrorResponse("배정 목록을 불러올 수 없습니다.");
  }
}

/** 가이드 검색 */
export async function searchGuidesAction(
  filters: GuideListFilter,
): Promise<ActionResponse<{ data: ExplorationGuide[]; count: number }>> {
  try {
    await requireAdminOrConsultant();
    const result = await findGuides({ ...filters, status: filters.status ?? "approved" });
    return createSuccessResponse(result);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "searchGuides" }, error, { filters });
    return createErrorResponse("가이드 검색에 실패했습니다.");
  }
}

/** 가이드 상세 */
export async function fetchGuideDetailAction(
  guideId: string,
): Promise<ActionResponse<GuideDetail | null>> {
  try {
    await requireAdminOrConsultant();
    const data = await findGuideById(guideId);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchGuideDetail" }, error, { guideId });
    return createErrorResponse("가이드 상세를 불러올 수 없습니다.");
  }
}

/** 가이드 배정 */
export async function assignGuideAction(input: {
  studentId: string;
  guideId: string;
  schoolYear: number;
  grade: number;
  schoolName?: string;
  notes?: string;
  /** 세특 대상 과목 UUID */
  targetSubjectId?: string;
  /** 창체 대상 영역 */
  targetActivityType?: "autonomy" | "club" | "career";
  /** 연결 레코드 타입 */
  linkedRecordType?: LinkedRecordType;
  /** 연결 레코드 ID */
  linkedRecordId?: string;
}): Promise<ActionResponse<GuideAssignment>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return createErrorResponse("기관 정보를 찾을 수 없습니다.");
    }

    const data = await createAssignment({
      tenantId,
      studentId: input.studentId,
      guideId: input.guideId,
      assignedBy: userId,
      schoolYear: input.schoolYear,
      grade: input.grade,
      schoolName: input.schoolName,
      notes: input.notes,
      targetSubjectId: input.targetSubjectId,
      targetActivityType: input.targetActivityType,
      linkedRecordType: input.linkedRecordType,
      linkedRecordId: input.linkedRecordId,
    });
    return createSuccessResponse(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return createErrorResponse("이미 배정된 가이드입니다.");
    }
    logActionError({ ...LOG_CTX, action: "assignGuide" }, error, { input });
    return createErrorResponse("가이드 배정에 실패했습니다.");
  }
}

/** 배정 상태 변경 */
export async function updateAssignmentStatusAction(
  assignmentId: string,
  status: AssignmentStatus,
): Promise<ActionResponse> {
  try {
    const { userId } = await requireAdminOrConsultant();
    await updateAssignmentStatus(assignmentId, status, userId);
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateAssignmentStatus" }, error, {
      assignmentId,
      status,
    });
    return createErrorResponse("상태 변경에 실패했습니다.");
  }
}

/** 배정 삭제 */
export async function removeAssignmentAction(
  assignmentId: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    await deleteAssignment(assignmentId);
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeAssignment" }, error, { assignmentId });
    return createErrorResponse("배정 삭제에 실패했습니다.");
  }
}

/** 이행률 조회 */
export async function fetchCompletionRateAction(
  studentId: string,
): Promise<ActionResponse<{ total: number; linked: number; rate: number }>> {
  try {
    await requireAdminOrConsultant();
    const data = await getCompletionRate(studentId);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchCompletionRate" }, error, { studentId });
    return createErrorResponse("이행률을 불러올 수 없습니다.");
  }
}

/** 계열 목록 */
export async function fetchCareerFieldsAction(): Promise<
  ActionResponse<CareerField[]>
> {
  try {
    await requireAdminOrConsultant();
    const data = await findAllCareerFields();
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchCareerFields" }, error);
    return createErrorResponse("계열 목록을 불러올 수 없습니다.");
  }
}
