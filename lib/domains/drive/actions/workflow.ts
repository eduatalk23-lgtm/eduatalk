"use server";

/**
 * Drive Workflow Server Actions
 * 파일 요청 생성, 제출, 승인, 반려
 */

import {
  resolveAuthContext,
  isAdminContext,
  isParentContext,
} from "@/lib/auth/strategies";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import * as repo from "../repository";
import { uploadDriveFile } from "../services/upload";
import {
  DRIVE_EXPIRY_DAYS,
  type FileCategory,
  type FileRequest,
  type FileRequestWithStudent,
  type FileRequestStatus,
  type RequestTemplate,
  type DriveFile,
  type UploaderRole,
} from "../types";
import { ensureStudentPrimaryCalendar } from "@/lib/domains/calendar/helpers";
import { createCalendarEventAction } from "@/lib/domains/admin-plan/actions/calendarEvents";

// =============================================================================
// Create Request (Admin only)
// =============================================================================

interface CreateRequestInput {
  studentId: string;
  title: string;
  description?: string;
  category: FileCategory;
  allowedMimeTypes?: string[];
  deadline?: string;
  /** 캘린더에 마감일 이벤트를 생성할지 여부 */
  addToCalendar?: boolean;
}

export async function createFileRequestAction(
  input: CreateRequestInput
): Promise<{ success: boolean; request?: FileRequest; error?: string }> {
  try {
    const auth = await resolveAuthContext({ studentId: input.studentId });

    if (!isAdminContext(auth)) {
      return { success: false, error: "관리자 권한이 필요합니다." };
    }

    if (input.deadline) {
      const deadlineDate = new Date(input.deadline);
      if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
        return { success: false, error: "마감일은 미래 날짜여야 합니다." };
      }
    }

    const request = await repo.insertFileRequest({
      tenant_id: auth.tenantId,
      student_id: input.studentId,
      created_by: auth.userId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      allowed_mime_types: input.allowedMimeTypes ?? null,
      deadline: input.deadline ?? null,
    });

    // 캘린더 이벤트 생성 (기한이 있고 addToCalendar이 true일 때)
    if (input.deadline && input.addToCalendar !== false) {
      try {
        const calendarId = await ensureStudentPrimaryCalendar(
          input.studentId,
          auth.tenantId,
        );
        const deadlineDate = new Date(input.deadline);
        const planDate = deadlineDate.toISOString().slice(0, 10);

        const result = await createCalendarEventAction({
          calendarId,
          title: `제출 마감: ${input.title}`,
          planDate,
          isAllDay: true,
          isTask: true,
          label: "파일_제출",
          color: "#f59e0b",
          description: input.description || undefined,
        });

        if (result.eventId) {
          await repo.linkCalendarEventToRequest(request.id, result.eventId);
        }
      } catch (calErr) {
        // Calendar event creation failure should not block request creation
        console.error("[Workflow] Calendar event creation failed:", calErr);
      }
    }

    return { success: true, request };
  } catch (err) {
    console.error("[Workflow] createFileRequest error:", err);
    return { success: false, error: "요청 생성 중 오류가 발생했습니다." };
  }
}

// =============================================================================
// Submit File (Student / Parent)
// =============================================================================

interface SubmitResult {
  success: boolean;
  file?: DriveFile;
  error?: string;
}

export async function submitFileForRequestAction(
  requestId: string,
  formData: FormData
): Promise<SubmitResult> {
  try {
    const request = await repo.getFileRequestById(requestId);
    if (!request) {
      return { success: false, error: "요청을 찾을 수 없습니다." };
    }

    if (request.status === "approved") {
      return { success: false, error: "이미 승인된 요청입니다." };
    }

    const auth = await resolveAuthContext({ studentId: request.student_id });

    let uploaderRole: UploaderRole = "student";
    if (isAdminContext(auth)) uploaderRole = "admin";
    else if (isParentContext(auth)) uploaderRole = "parent";

    // 기존 제출 파일이 있으면 같은 version_group 사용
    const existingFiles = await repo.getFilesForRequest(requestId);
    const versionGroupId =
      existingFiles.length > 0
        ? existingFiles[0].version_group_id
        : undefined;

    // 파일 업로드 (workflow context)
    const uploadResult = await uploadDriveFile(formData, {
      tenantId: auth.tenantId,
      studentId: request.student_id,
      userId: auth.userId,
      uploaderRole,
      category: request.category as FileCategory,
      contextType: "workflow",
      contextId: requestId,
      versionGroupId,
    });

    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error };
    }

    // 상태를 submitted로 변경
    await repo.updateFileRequestStatus(requestId, { status: "submitted" });

    return { success: true, file: uploadResult.file };
  } catch (err) {
    console.error("[Workflow] submitFileForRequest error:", err);
    return { success: false, error: "제출 중 오류가 발생했습니다." };
  }
}

// =============================================================================
// Approve (Admin only)
// =============================================================================

export async function approveSubmissionAction(
  requestId: string,
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const request = await repo.getFileRequestById(requestId);
    if (!request) {
      return { success: false, error: "요청을 찾을 수 없습니다." };
    }

    const auth = await resolveAuthContext({ studentId: request.student_id });
    if (!isAdminContext(auth)) {
      return { success: false, error: "관리자 권한이 필요합니다." };
    }

    await repo.updateFileRequestStatus(requestId, {
      status: "approved",
      approved_file_id: fileId,
    });

    // 승인된 파일들의 만료일 설정 (승인일 + 7일)
    const files = await repo.getFilesForRequest(requestId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DRIVE_EXPIRY_DAYS);

    for (const file of files) {
      await repo.updateFileExpiry(file.id, expiresAt.toISOString());
    }

    return { success: true };
  } catch (err) {
    console.error("[Workflow] approveSubmission error:", err);
    return { success: false, error: "승인 처리 중 오류가 발생했습니다." };
  }
}

// =============================================================================
// Reject (Admin only)
// =============================================================================

export async function rejectSubmissionAction(
  requestId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const request = await repo.getFileRequestById(requestId);
    if (!request) {
      return { success: false, error: "요청을 찾을 수 없습니다." };
    }

    const auth = await resolveAuthContext({ studentId: request.student_id });
    if (!isAdminContext(auth)) {
      return { success: false, error: "관리자 권한이 필요합니다." };
    }

    // 반려 사유 새니타이징 (XSS 방지)
    const sanitizedReason = reason
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .slice(0, 500);

    await repo.updateFileRequestStatus(requestId, {
      status: "rejected",
      rejection_reason: sanitizedReason,
    });

    // 반려된 파일들의 만료일 설정 (반려일 + 7일)
    const files = await repo.getFilesForRequest(requestId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DRIVE_EXPIRY_DAYS);

    for (const file of files) {
      await repo.updateFileExpiry(file.id, expiresAt.toISOString());
    }

    return { success: true };
  } catch (err) {
    console.error("[Workflow] rejectSubmission error:", err);
    return { success: false, error: "반려 처리 중 오류가 발생했습니다." };
  }
}

// =============================================================================
// Query
// =============================================================================

export async function getFileRequestsAction(
  studentId: string
): Promise<{
  requests: FileRequest[];
  filesByRequest: Record<string, DriveFile[]>;
}> {
  try {
    await resolveAuthContext({ studentId });

    const requests = await repo.getFileRequestsByStudent(studentId);

    const filesByRequest: Record<string, DriveFile[]> = {};
    for (const req of requests) {
      if (req.status !== "pending" && req.status !== "overdue") {
        filesByRequest[req.id] = await repo.getFilesForRequest(req.id);
      }
    }

    return { requests, filesByRequest };
  } catch (err) {
    console.error("[Workflow] getFileRequests error:", err);
    return { requests: [], filesByRequest: {} };
  }
}

// =============================================================================
// Tenant-wide Query (Admin Dashboard)
// =============================================================================

export async function getAllFileRequestsAction(options?: {
  status?: FileRequestStatus;
  search?: string;
  page?: number;
}): Promise<{
  requests: FileRequestWithStudent[];
  hasMore: boolean;
}> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return { requests: [], hasMore: false };
    }

    const limit = 20;
    const page = options?.page ?? 1;
    const offset = (page - 1) * limit;

    const requests = await repo.getFileRequestsByTenant(tenantId, {
      status: options?.status,
      search: options?.search,
      limit: limit + 1,
      offset,
    });

    const hasMore = requests.length > limit;
    return {
      requests: hasMore ? requests.slice(0, limit) : requests,
      hasMore,
    };
  } catch (err) {
    console.error("[Workflow] getAllFileRequests error:", err);
    return { requests: [], hasMore: false };
  }
}

export async function getFileRequestKpiAction(): Promise<{
  pending: number;
  submitted: number;
  overdue: number;
}> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return { pending: 0, submitted: 0, overdue: 0 };
    }

    return await repo.getFileRequestKpiCounts(tenantId);
  } catch (err) {
    console.error("[Workflow] getFileRequestKpi error:", err);
    return { pending: 0, submitted: 0, overdue: 0 };
  }
}

// =============================================================================
// Bulk Create (Admin)
// =============================================================================

interface BulkCreateInput {
  studentIds: string[];
  title: string;
  description?: string;
  category: FileCategory;
  allowedMimeTypes?: string[];
  deadline?: string;
}

interface BulkCreateResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ studentId: string; error: string }>;
}

export async function bulkCreateFileRequestsAction(
  input: BulkCreateInput
): Promise<{ success: boolean; result?: BulkCreateResult; error?: string }> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return { success: false, error: "테넌트 정보가 없습니다." };
    }

    if (input.studentIds.length === 0) {
      return { success: false, error: "학생을 선택해주세요." };
    }

    if (!input.title.trim()) {
      return { success: false, error: "제목을 입력해주세요." };
    }

    // XSS 방지 sanitize (rejectSubmissionAction과 동일 패턴)
    const sanitizedTitle = input.title
      .trim()
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .slice(0, 200);
    const sanitizedDescription = input.description
      ? input.description
          .trim()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .slice(0, 1000)
      : null;

    const result: BulkCreateResult = {
      total: input.studentIds.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    const settled = await Promise.allSettled(
      input.studentIds.map(async (studentId) => {
        await repo.insertFileRequest({
          tenant_id: tenantId,
          student_id: studentId,
          created_by: userId,
          title: sanitizedTitle,
          description: sanitizedDescription,
          category: input.category,
          allowed_mime_types: input.allowedMimeTypes ?? null,
          deadline: input.deadline ?? null,
        });
      })
    );

    settled.forEach((s, i) => {
      if (s.status === "fulfilled") {
        result.succeeded++;
      } else {
        result.failed++;
        result.errors.push({
          studentId: input.studentIds[i],
          error: s.reason instanceof Error ? s.reason.message : "알 수 없는 오류",
        });
      }
    });

    return { success: true, result };
  } catch (err) {
    console.error("[Workflow] bulkCreateFileRequests error:", err);
    return { success: false, error: "일괄 요청 생성 중 오류가 발생했습니다." };
  }
}

// =============================================================================
// Delete
// =============================================================================

export async function deleteFileRequestAction(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const request = await repo.getFileRequestById(requestId);
    if (!request) {
      return { success: false, error: "요청을 찾을 수 없습니다." };
    }

    const auth = await resolveAuthContext({ studentId: request.student_id });
    if (!isAdminContext(auth)) {
      return { success: false, error: "관리자 권한이 필요합니다." };
    }

    // 연결된 캘린더 이벤트 삭제
    if (request.calendar_event_id) {
      try {
        const { deleteEventAction } = await import("@/lib/domains/calendar/actions/events");
        await deleteEventAction(request.calendar_event_id);
      } catch {
        // Calendar event deletion failure should not block request deletion
      }
    }

    await repo.deleteFileRequest(requestId);
    return { success: true };
  } catch (err) {
    console.error("[Workflow] deleteFileRequest error:", err);
    return { success: false, error: "삭제 중 오류가 발생했습니다." };
  }
}

// =============================================================================
// Request Templates
// =============================================================================

export async function getRequestTemplatesAction(): Promise<RequestTemplate[]> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!userId || !tenantId) return [];
    return repo.getTemplatesByTenant(tenantId);
  } catch {
    return [];
  }
}

export async function createRequestTemplateAction(input: {
  name: string;
  title: string;
  description?: string;
  category: FileCategory;
  allowedMimeTypes?: string[];
  deadlineDays?: number;
}): Promise<{ success: boolean; template?: RequestTemplate; error?: string }> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!userId || !tenantId) {
      return { success: false, error: "관리자 권한이 필요합니다." };
    }

    const name = input.name.trim().slice(0, 50);
    const title = input.title.trim().slice(0, 200);
    if (!name || !title) {
      return { success: false, error: "템플릿 이름과 제목은 필수입니다." };
    }

    const template = await repo.insertTemplate({
      tenant_id: tenantId,
      name,
      title,
      description: input.description?.trim().slice(0, 500) || null,
      category: input.category,
      allowed_mime_types: input.allowedMimeTypes ?? null,
      deadline_days: input.deadlineDays ?? null,
      created_by: userId,
    });

    return { success: true, template };
  } catch (err) {
    console.error("[Workflow] createRequestTemplate error:", err);
    return { success: false, error: "템플릿 생성 중 오류가 발생했습니다." };
  }
}

export async function deleteRequestTemplateAction(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!userId || !tenantId) {
      return { success: false, error: "관리자 권한이 필요합니다." };
    }

    const ok = await repo.deleteTemplate(templateId);
    if (!ok) return { success: false, error: "삭제에 실패했습니다." };
    return { success: true };
  } catch (err) {
    console.error("[Workflow] deleteRequestTemplate error:", err);
    return { success: false, error: "삭제 중 오류가 발생했습니다." };
  }
}
