"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import type {
  UniversityDepartment,
  DepartmentWithCurriculum,
  BypassMajorPair,
  BypassCandidateWithDetails,
  BypassCandidateStatus,
  DepartmentSearchFilter,
  CurriculumCompareResult,
  DepartmentClassification,
} from "../types";
import {
  searchDepartments,
  findDepartmentById,
  findBypassPairs,
  findCandidates,
  updateCandidateStatus,
  compareCurriculum,
  findClassifications,
} from "../repository";

const LOG_CTX = { domain: "bypass-major", action: "bypass" };

/** 학과 검색 */
export async function searchDepartmentsAction(
  filter: DepartmentSearchFilter,
): Promise<
  ActionResponse<{ data: UniversityDepartment[]; count: number }>
> {
  try {
    await requireAdminOrConsultant();
    const result = await searchDepartments(filter);
    return createSuccessResponse(result);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "searchDepartments" }, error, {
      filter,
    });
    return createErrorResponse("학과 검색에 실패했습니다.");
  }
}

/** 학과 상세 (교육과정 포함) */
export async function getDepartmentDetailAction(
  departmentId: string,
): Promise<ActionResponse<DepartmentWithCurriculum | null>> {
  try {
    await requireAdminOrConsultant();
    const data = await findDepartmentById(departmentId);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "getDepartmentDetail" }, error, {
      departmentId,
    });
    return createErrorResponse("학과 상세를 불러올 수 없습니다.");
  }
}

/** 사전 매핑 우회학과 페어 조회 */
export async function getBypassPairsAction(
  departmentId: string,
): Promise<ActionResponse<BypassMajorPair[]>> {
  try {
    await requireAdminOrConsultant();
    const data = await findBypassPairs(departmentId);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "getBypassPairs" }, error, {
      departmentId,
    });
    return createErrorResponse("우회학과 페어를 불러올 수 없습니다.");
  }
}

/** 우회학과 후보 조회 (학생별) */
export async function getCandidatesAction(
  studentId: string,
  schoolYear: number,
): Promise<ActionResponse<BypassCandidateWithDetails[]>> {
  try {
    await requireAdminOrConsultant();
    const data = await findCandidates(studentId, schoolYear);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "getCandidates" }, error, {
      studentId,
      schoolYear,
    });
    return createErrorResponse("우회학과 후보를 불러올 수 없습니다.");
  }
}

/** 후보 메모 저장 */
export async function saveCandidateNotesAction(
  candidateId: string,
  notes: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    // notes만 업데이트 — status는 변경하지 않음
    await updateCandidateStatus(candidateId, "candidate", notes);
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveCandidateNotes" }, error, {
      candidateId,
    });
    return createErrorResponse("메모 저장에 실패했습니다.");
  }
}

/** 후보 상태 변경 */
export async function updateCandidateStatusAction(
  candidateId: string,
  status: BypassCandidateStatus,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    await updateCandidateStatus(candidateId, status);
    return createSuccessResponse();
  } catch (error) {
    logActionError(
      { ...LOG_CTX, action: "updateCandidateStatus" },
      error,
      { candidateId, status },
    );
    return createErrorResponse("상태 변경에 실패했습니다.");
  }
}

/** 교육과정 비교 */
export async function compareCurriculumAction(
  deptIdA: string,
  deptIdB: string,
): Promise<ActionResponse<CurriculumCompareResult | null>> {
  try {
    await requireAdminOrConsultant();
    const data = await compareCurriculum(deptIdA, deptIdB);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "compareCurriculum" }, error, {
      deptIdA,
      deptIdB,
    });
    return createErrorResponse("교육과정 비교에 실패했습니다.");
  }
}

/** 분류 코드 목록 */
export async function fetchClassificationsAction(): Promise<
  ActionResponse<DepartmentClassification[]>
> {
  try {
    await requireAdminOrConsultant();
    const data = await findClassifications();
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchClassifications" }, error);
    return createErrorResponse("분류 코드를 불러올 수 없습니다.");
  }
}
