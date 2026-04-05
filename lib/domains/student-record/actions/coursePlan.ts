"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { createSuccessResponse, createErrorResponse } from "@/lib/types/actionResponse";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { syncPipelineTaskStatus } from "./pipeline";
import * as service from "../course-plan/service";
import * as repo from "../course-plan/repository";
import type {
  CoursePlanTabData,
  CoursePlanWithSubject,
  CoursePlanStatus,
} from "../course-plan/types";

const LOG_CTX = { domain: "student-record", module: "coursePlan" };

/** 수강 계획 탭 데이터 조회 */
export async function fetchCoursePlanTabData(
  studentId: string,
): Promise<ActionResponse<CoursePlanTabData>> {
  try {
    await requireAdminOrConsultant();
    const data = await service.fetchCoursePlanData(studentId);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchCoursePlanTabData" }, error);
    return createErrorResponse("수강 계획 조회 중 오류가 발생했습니다.");
  }
}

/** 추천 생성 */
export async function generateRecommendationsAction(
  studentId: string,
  tenantId: string,
): Promise<ActionResponse<CoursePlanWithSubject[]>> {
  try {
    await requireAdminOrConsultant();
    const data = await service.generateAndSaveRecommendations(studentId, tenantId);
    // 파이프라인 상태 동기화 (fire-and-forget)
    syncPipelineTaskStatus(studentId, "course_recommendation").catch((err) => logActionWarn(LOG_CTX, `syncPipelineTaskStatus failed: ${err instanceof Error ? err.message : String(err)}`));
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "generateRecommendationsAction" }, error);
    const msg = error instanceof Error ? error.message : "추천 생성 중 오류가 발생했습니다.";
    return createErrorResponse(msg);
  }
}

/** 단건 저장 (수동 추가) */
export async function saveCoursePlanAction(input: {
  tenantId: string;
  studentId: string;
  subjectId: string;
  grade: number;
  semester: number;
  notes?: string;
}): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const [result] = await repo.bulkUpsert([{
      tenantId: input.tenantId,
      studentId: input.studentId,
      subjectId: input.subjectId,
      grade: input.grade,
      semester: input.semester,
      planStatus: "confirmed",
      source: "consultant",
      notes: input.notes,
    }]);
    return createSuccessResponse({ id: result.id });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveCoursePlanAction" }, error);
    return createErrorResponse("수강 계획 저장 중 오류가 발생했습니다.");
  }
}

/** 상태 변경 */
export async function updateCoursePlanStatusAction(
  id: string,
  status: CoursePlanStatus,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    await repo.updateStatus(id, status);

    // confirmed 전환 시 빈 세특 자동 생성
    if (status === "confirmed") {
      try {
        const plan = await repo.findById(id);
        if (plan) {
          const supabase = await createSupabaseServerClient();
          const { data: student } = await supabase
            .from("students")
            .select("grade, tenant_id")
            .eq("id", plan.student_id)
            .single();
          if (student) {
            const syncResult = await service.syncConfirmedToSeteks(
              plan.student_id,
              student.tenant_id,
              student.grade ?? 1,
              calculateSchoolYear(),
              plan.grade,
              plan.semester,
            );
            // 가이드 auto-link: 생성된 세특과 target_subject_id 매칭
            if (syncResult.createdSeteks.length > 0) {
              const { linkAssignmentsToSeteks } = await import("@/lib/domains/guide/repository");
              await linkAssignmentsToSeteks(plan.student_id, student.tenant_id, syncResult.createdSeteks).catch((err) => logActionWarn(LOG_CTX, `linkAssignmentsToSeteks failed: ${err instanceof Error ? err.message : String(err)}`));
            }
          }
        }
      } catch (syncErr) {
        logActionError({ ...LOG_CTX, action: "updateCoursePlanStatusAction.syncSeteks" }, syncErr);
      }
    }

    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateCoursePlanStatusAction" }, error);
    return createErrorResponse("상태 변경 중 오류가 발생했습니다.");
  }
}

/** 삭제 */
export async function removeCoursePlanAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    await repo.remove(id);
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeCoursePlanAction" }, error);
    return createErrorResponse("삭제 중 오류가 발생했습니다.");
  }
}

/** 학기 일괄 확정 */
export async function bulkConfirmAction(
  studentId: string,
  grade: number,
  semester: number,
): Promise<ActionResponse<{ count: number }>> {
  try {
    await requireAdminOrConsultant();
    const count = await repo.bulkConfirm(studentId, grade, semester);

    // 빈 세특 자동 생성 (실패해도 confirm은 유지)
    try {
      const supabase = await createSupabaseServerClient();
      const { data: student } = await supabase
        .from("students")
        .select("grade, tenant_id")
        .eq("id", studentId)
        .single();
      if (student) {
        const syncResult = await service.syncConfirmedToSeteks(
          studentId,
          student.tenant_id,
          student.grade ?? 1,
          calculateSchoolYear(),
          grade,
          semester,
        );
        // 가이드 auto-link
        if (syncResult.createdSeteks.length > 0) {
          const { linkAssignmentsToSeteks } = await import("@/lib/domains/guide/repository");
          await linkAssignmentsToSeteks(studentId, student.tenant_id, syncResult.createdSeteks).catch(() => {});
        }
      }
    } catch (syncErr) {
      logActionError({ ...LOG_CTX, action: "bulkConfirmAction.syncSeteks" }, syncErr);
    }

    return createSuccessResponse({ count });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "bulkConfirmAction" }, error);
    return createErrorResponse("일괄 확정 중 오류가 발생했습니다.");
  }
}

/** P2-C: 두 과목의 우선순위 스왑 */
export async function swapCoursePlanPriorityAction(
  planIdA: string,
  priorityA: number,
  planIdB: string,
  priorityB: number,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    await Promise.all([
      repo.updatePriority(planIdA, priorityB),
      repo.updatePriority(planIdB, priorityA),
    ]);
    return createSuccessResponse(undefined);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "swapCoursePlanPriority" }, error);
    return createErrorResponse("순서 변경 중 오류가 발생했습니다.");
  }
}
