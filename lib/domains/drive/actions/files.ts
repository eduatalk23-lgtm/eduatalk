"use server";

/**
 * Drive File Server Actions
 * 파일 업로드, 조회, 삭제, signed URL 생성
 */

import {
  resolveAuthContext,
  isAdminContext,
  isParentContext,
} from "@/lib/auth/strategies";
import * as repo from "../repository";
import * as storage from "../storage";
import { uploadDriveFile, type UploadResult } from "../services/upload";
import type { FileCategory, DriveFile, DriveFileFilter, UploaderRole } from "../types";

// =============================================================================
// Upload
// =============================================================================

export async function uploadDriveFileAction(
  formData: FormData,
  options: {
    studentId: string;
    category: FileCategory;
    contextType?: "drive" | "workflow";
    contextId?: string;
    versionGroupId?: string;
  }
): Promise<UploadResult> {
  try {
    const auth = await resolveAuthContext({ studentId: options.studentId });

    let uploaderRole: UploaderRole = "student";
    if (isAdminContext(auth)) uploaderRole = "admin";
    else if (isParentContext(auth)) uploaderRole = "parent";

    return await uploadDriveFile(formData, {
      tenantId: auth.tenantId,
      studentId: options.studentId,
      userId: auth.userId,
      uploaderRole,
      category: options.category,
      contextType: options.contextType,
      contextId: options.contextId,
      versionGroupId: options.versionGroupId,
    });
  } catch (err) {
    console.error("[DriveActions] uploadDriveFile error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "업로드 중 오류가 발생했습니다.",
    };
  }
}

// =============================================================================
// Query
// =============================================================================

export async function getDriveFilesAction(
  studentId: string,
  filter?: DriveFileFilter
): Promise<{ files: DriveFile[]; signedUrls: Record<string, string> }> {
  try {
    await resolveAuthContext({ studentId });

    const files = await repo.getFilesByStudent(studentId, filter);

    const urlMap = await storage.createSignedUrls(
      files.map((f) => f.storage_path)
    );
    const signedUrls: Record<string, string> = {};
    for (const f of files) {
      const url = urlMap.get(f.storage_path);
      if (url) signedUrls[f.id] = url;
    }

    return { files, signedUrls };
  } catch (err) {
    console.error("[DriveActions] getDriveFiles error:", err);
    return { files: [], signedUrls: {} };
  }
}

export async function getFileSignedUrlAction(
  fileId: string
): Promise<string | null> {
  try {
    const file = await repo.getFileById(fileId);
    if (!file) return null;

    await resolveAuthContext({ studentId: file.student_id });
    return storage.createSignedUrl(file.storage_path);
  } catch {
    return null;
  }
}

// =============================================================================
// Delete
// =============================================================================

export async function deleteDriveFileAction(
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const file = await repo.getFileById(fileId);
    if (!file) return { success: false, error: "파일을 찾을 수 없습니다." };

    const auth = await resolveAuthContext({ studentId: file.student_id });

    // 관리자: 같은 테넌트 파일 삭제 가능
    // 학생/학부모: 본인이 업로드한 파일만 삭제 가능
    if (!isAdminContext(auth) && auth.userId !== file.uploaded_by) {
      return { success: false, error: "삭제 권한이 없습니다." };
    }

    await storage.deleteFiles([file.storage_path]);
    await repo.deleteFileById(fileId);

    return { success: true };
  } catch (err) {
    console.error("[DriveActions] deleteDriveFile error:", err);
    return { success: false, error: "삭제 중 오류가 발생했습니다." };
  }
}

// =============================================================================
// Quota
// =============================================================================

export async function getStudentDriveQuotaAction(studentId: string) {
  try {
    const { getStudentDriveQuota } = await import("../quota");
    return getStudentDriveQuota(studentId);
  } catch (err) {
    console.error("[DriveActions] getStudentDriveQuota error:", err);
    return { usedBytes: 0, totalBytes: 0, remainingBytes: 0, usagePercent: 0 };
  }
}
