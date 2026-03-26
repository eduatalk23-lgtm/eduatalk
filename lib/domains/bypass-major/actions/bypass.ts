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
  UniversityTransferPolicy,
} from "../types";
import {
  searchDepartments,
  findDepartmentById,
  findBypassPairs,
  findCandidates,
  updateCandidateStatus,
  updateCandidateNotes,
  saveCandidates,
  compareCurriculum,
  findClassifications,
  findTransferPolicies,
} from "../repository";
import { generateCandidates } from "../candidate-generator";
import { runBypassPipeline, type PipelineResult } from "../pipeline";
import type { DiscoveredDepartment, DiscoveryResult, DiagnosisContext } from "../department-discovery";

const LOG_CTX = { domain: "bypass-major", action: "bypass" };

/** 자동 학과 발견 결과 (UI용 — UniversityDepartment 포함) */
export interface DiscoverySuggestion {
  department: UniversityDepartment;
  matchSource: DiscoveredDepartment["matchSource"];
  matchConfidence: number;
}
export interface DiscoveryActionResult {
  suggestions: DiscoverySuggestion[];
  source: DiscoveryResult["source"];
  recommendedMajors: string[];
  diagnosisContext: DiagnosisContext | null;
}

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
    await updateCandidateNotes(candidateId, notes);
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

/** 우회학과 후보 자동 생성 */
export async function generateCandidatesAction(input: {
  studentId: string;
  targetDeptId: string;
  schoolYear: number;
  tenantId: string;
}): Promise<
  ActionResponse<{ totalGenerated: number; preMapped: number; similarity: number; noCurriculum?: boolean }>
> {
  try {
    await requireAdminOrConsultant();
    const result = await generateCandidates(input);
    if (result.candidates.length > 0) {
      await saveCandidates(result.candidates);
    }
    // 0건이고 목표 학과 교육과정이 없는 경우 플래그 전달
    if (result.candidates.length === 0) {
      const { fetchCurriculumWithTypeBatch } = await import("../repository");
      const currMap = await fetchCurriculumWithTypeBatch([input.targetDeptId]);
      if ((currMap.get(input.targetDeptId)?.length ?? 0) === 0) {
        return createSuccessResponse({ ...result.stats, noCurriculum: true });
      }
    }
    return createSuccessResponse(result.stats);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "generateCandidates" }, error, {
      studentId: input.studentId,
      targetDeptId: input.targetDeptId,
    });
    return createErrorResponse("후보 생성에 실패했습니다.");
  }
}

/** 수동 후보 추가 */
export async function addManualCandidateAction(input: {
  studentId: string;
  targetDeptId: string;
  candidateDeptId: string;
  schoolYear: number;
  tenantId: string;
  notes?: string;
}): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    await saveCandidates([
      {
        tenant_id: input.tenantId,
        student_id: input.studentId,
        target_department_id: input.targetDeptId,
        candidate_department_id: input.candidateDeptId,
        source: "manual",
        curriculum_similarity_score: null,
        placement_grade: null,
        competency_fit_score: null,
        composite_score: null,
        rationale: "수동 추가",
        consultant_notes: input.notes ?? null,
        status: "candidate",
        school_year: input.schoolYear,
        competency_rationale: null,
        curriculum_rationale: null,
        placement_rationale: null,
        placement_score: null,
        placement_source: null,
        recommendation_source: "target_based",
      },
    ]);
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addManualCandidate" }, error, {
      studentId: input.studentId,
      candidateDeptId: input.candidateDeptId,
    });
    return createErrorResponse("수동 후보 추가에 실패했습니다.");
  }
}

/** 3필터 파이프라인 실행 (커리큘럼 + 배치 + 역량) */
export async function runBypassPipelineAction(input: {
  studentId: string;
  tenantId: string;
  targetDeptId: string;
  schoolYear: number;
}): Promise<ActionResponse<PipelineResult>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    const result = await runBypassPipeline({
      ...input,
      tenantId: input.tenantId || tenantId!,
    });
    return createSuccessResponse(result);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "runBypassPipeline" }, error, {
      input,
    });
    return createErrorResponse("우회학과 파이프라인 실행에 실패했습니다.");
  }
}

/** 진단/희망학과 기반 목표 학과 자동 발견 */
export async function discoverTargetDepartmentsAction(
  studentId: string,
  schoolYear: number,
): Promise<ActionResponse<DiscoveryActionResult>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    const { discoverDepartmentsFromDiagnosis } = await import("../department-discovery");
    const discovery = await discoverDepartmentsFromDiagnosis(studentId, tenantId!, schoolYear);

    if (discovery.targetDepartments.length === 0) {
      return createSuccessResponse({
        suggestions: [],
        source: discovery.source,
        recommendedMajors: discovery.recommendedMajors,
        diagnosisContext: discovery.diagnosisContext,
      });
    }

    // 발견된 학과 ID로 UniversityDepartment 전체 객체 조회
    const deptIds = discovery.targetDepartments.map((d) => d.departmentId);
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { data: depts } = await supabase
      .from("university_departments")
      .select("*")
      .in("id", deptIds);

    const deptMap = new Map((depts ?? []).map((d) => [d.id, d as UniversityDepartment]));

    const suggestions: DiscoverySuggestion[] = [];
    for (const discovered of discovery.targetDepartments) {
      const dept = deptMap.get(discovered.departmentId);
      if (dept) {
        suggestions.push({
          department: dept,
          matchSource: discovered.matchSource,
          matchConfidence: discovered.matchConfidence,
        });
      }
    }

    return createSuccessResponse({
      suggestions,
      source: discovery.source,
      recommendedMajors: discovery.recommendedMajors,
      diagnosisContext: discovery.diagnosisContext,
    });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "discoverTargetDepartments" }, error, { studentId });
    return createErrorResponse("목표 학과 자동 발견에 실패했습니다.");
  }
}

/** 전과/복수전공 정책 조회 */
export async function getTransferPoliciesAction(
  universityName: string,
): Promise<ActionResponse<UniversityTransferPolicy[]>> {
  try {
    await requireAdminOrConsultant();
    const data = await findTransferPolicies(universityName);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "getTransferPolicies" }, error, {
      universityName,
    });
    return createErrorResponse("전과/복수전공 정보를 불러올 수 없습니다.");
  }
}
