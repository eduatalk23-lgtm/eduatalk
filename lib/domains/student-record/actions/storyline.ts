"use server";

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import type { ActionResponse } from "@/lib/types/actionResponse";
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/types/actionResponse";
import * as service from "../service";
import type {
  StorylineTabData,
  StorylineInsert,
  StorylineUpdate,
  StorylineLinkInsert,
  RoadmapItemInsert,
  RoadmapItemUpdate,
} from "../types";

const LOG_CTX = { domain: "student-record", action: "" };

// ============================================
// 스토리라인 탭 데이터 조회
// ============================================

export async function fetchStorylineTabData(
  studentId: string,
  schoolYear: number,
): Promise<ActionResponse<StorylineTabData>> {
  try {
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const data = await service.getStorylineTabData(studentId, schoolYear, tenantId!);
    return createSuccessResponse(data);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchStorylineTabData" }, error, { studentId });
    return createErrorResponse("스토리라인 데이터를 불러오는 중 오류가 발생했습니다.");
  }
}

// ============================================
// 스토리라인 CRUD
// ============================================

export async function saveStorylineAction(
  input: StorylineInsert,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.saveStoryline(input);
    if (!result.success) return createErrorResponse(result.error ?? "스토리라인 저장 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveStorylineAction" }, error);
    return createErrorResponse("스토리라인 저장 중 오류가 발생했습니다.");
  }
}

export async function updateStorylineAction(
  id: string,
  updates: StorylineUpdate,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.updateStoryline(id, updates);
    if (!result.success) return createErrorResponse(result.error ?? "스토리라인 수정 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateStorylineAction" }, error);
    return createErrorResponse("스토리라인 수정 중 오류가 발생했습니다.");
  }
}

export async function removeStorylineAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removeStoryline(id);
    if (!result.success) return createErrorResponse(result.error ?? "스토리라인 삭제 실패");
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeStorylineAction" }, error);
    return createErrorResponse("스토리라인 삭제 중 오류가 발생했습니다.");
  }
}

// ============================================
// 스토리라인 링크
// ============================================

export async function addStorylineLinkAction(
  input: StorylineLinkInsert,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.addStorylineLink(input);
    if (!result.success) return createErrorResponse(result.error ?? "활동 연결 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "addStorylineLinkAction" }, error);
    return createErrorResponse("활동 연결 중 오류가 발생했습니다.");
  }
}

export async function removeStorylineLinkAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removeStorylineLink(id);
    if (!result.success) return createErrorResponse(result.error ?? "연결 해제 실패");
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeStorylineLinkAction" }, error);
    return createErrorResponse("활동 연결 해제 중 오류가 발생했습니다.");
  }
}

// ============================================
// 로드맵 CRUD
// ============================================

export async function saveRoadmapItemAction(
  input: RoadmapItemInsert,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.saveRoadmapItem(input);
    if (!result.success) return createErrorResponse(result.error ?? "로드맵 항목 저장 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "saveRoadmapItemAction" }, error);
    return createErrorResponse("로드맵 항목 저장 중 오류가 발생했습니다.");
  }
}

export async function updateRoadmapItemAction(
  id: string,
  updates: RoadmapItemUpdate,
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireAdminOrConsultant();
    const result = await service.updateRoadmapItem(id, updates);
    if (!result.success) return createErrorResponse(result.error ?? "로드맵 항목 수정 실패");
    return createSuccessResponse({ id: result.id! });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "updateRoadmapItemAction" }, error);
    return createErrorResponse("로드맵 항목 수정 중 오류가 발생했습니다.");
  }
}

export async function removeRoadmapItemAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireAdminOrConsultant();
    const result = await service.removeRoadmapItem(id);
    if (!result.success) return createErrorResponse(result.error ?? "로드맵 항목 삭제 실패");
    return createSuccessResponse();
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "removeRoadmapItemAction" }, error);
    return createErrorResponse("로드맵 항목 삭제 중 오류가 발생했습니다.");
  }
}
