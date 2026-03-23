"use server";

import { requireStudentAuth } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import type { ActionResponse } from "@/lib/types/actionResponse";
import type {
  AssignmentWithGuide,
  GuideDetail,
  AssignmentStatus,
} from "../types";
import {
  findAssignmentsWithGuides,
  findGuideById,
  getCompletionRate,
} from "../repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LOG_CTX = { domain: "guide", action: "student-guide" };

/** 내 배정 목록 조회 */
export async function fetchMyAssignmentsAction(
  schoolYear?: number,
): Promise<ActionResponse<AssignmentWithGuide[]>> {
  try {
    const { userId } = await requireStudentAuth();
    const data = await findAssignmentsWithGuides(userId, schoolYear);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchMyAssignments" }, error);
    return createErrorResponse("배정 목록을 불러올 수 없습니다.");
  }
}

/** 내 가이드 상세 조회 (setek_examples 제거) */
export async function fetchMyGuideDetailAction(
  guideId: string,
): Promise<ActionResponse<GuideDetail | null>> {
  try {
    await requireStudentAuth();
    const data = await findGuideById(guideId);

    // setek_examples는 교사/컨설턴트 전용 — 학생에게 미노출
    if (data?.content) {
      data.content.setek_examples = [];
    }

    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchMyGuideDetail" }, error, { guideId });
    return createErrorResponse("가이드 상세를 불러올 수 없습니다.");
  }
}

/** 내 배정 상태 변경 (학생이 진행 시작 / 제출) */
export async function updateMyAssignmentStatusAction(
  assignmentId: string,
  status: AssignmentStatus,
  studentNotes?: string,
): Promise<ActionResponse> {
  try {
    const { userId } = await requireStudentAuth();

    // 학생은 in_progress, submitted만 설정 가능
    if (status !== "in_progress" && status !== "submitted") {
      return createErrorResponse("허용되지 않는 상태 변경입니다.");
    }

    // 본인의 배정인지 확인
    const supabase = await createSupabaseServerClient();
    const { data: assignment, error: fetchError } = await supabase
      .from("exploration_guide_assignments")
      .select("student_id")
      .eq("id", assignmentId)
      .single();

    if (fetchError || !assignment) {
      return createErrorResponse("배정 정보를 찾을 수 없습니다.");
    }
    if (assignment.student_id !== userId) {
      return createErrorResponse("본인의 배정만 변경할 수 있습니다.");
    }

    // 상태 + 노트를 단일 UPDATE로 실행 (레이스 컨디션 방지)
    const updates: Record<string, unknown> = { status };
    if (status === "submitted") updates.submitted_at = new Date().toISOString();
    if (studentNotes !== undefined) updates.student_notes = studentNotes;

    const { error: updateError } = await supabase
      .from("exploration_guide_assignments")
      .update(updates)
      .eq("id", assignmentId);
    if (updateError) throw updateError;

    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateMyAssignmentStatus" }, error, {
      assignmentId,
      status,
    });
    return createErrorResponse("상태 변경에 실패했습니다.");
  }
}

/** 내 이행률 조회 */
export async function fetchMyCompletionRateAction(): Promise<
  ActionResponse<{ total: number; linked: number; rate: number }>
> {
  try {
    const { userId } = await requireStudentAuth();
    const data = await getCompletionRate(userId);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchMyCompletionRate" }, error);
    return createErrorResponse("이행률을 불러올 수 없습니다.");
  }
}
