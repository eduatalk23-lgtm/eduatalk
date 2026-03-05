"use server";

/**
 * Drive Distribution Server Actions
 * 관리자 → 학생 자료 배포 (읽기전용)
 */

import { resolveAuthContext } from "@/lib/auth/strategies";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import * as repo from "../repository";
import * as storage from "../storage";
import { uploadDriveFile } from "../services/upload";
import {
  DRIVE_EXPIRY_DAYS,
  type FileCategory,
  type DriveFile,
  type FileDistribution,
  type DistributionWithFile,
  type DistributionTracking,
} from "../types";

// =============================================================================
// Upload & Distribute (Admin)
// =============================================================================

interface DistributeInput {
  studentIds: string[];
  title: string;
  description?: string;
  category: FileCategory;
}

interface DistributeResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ studentId: string; error: string }>;
}

export async function uploadAndDistributeAction(
  formData: FormData,
  input: DistributeInput
): Promise<{ success: boolean; result?: DistributeResult; error?: string }> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return { success: false, error: "테넌트 정보가 없습니다." };
    }

    if (input.studentIds.length === 0) {
      return { success: false, error: "대상 학생을 선택해주세요." };
    }

    const sanitizedTitle = input.title
      .trim()
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .slice(0, 200);
    if (!sanitizedTitle) {
      return { success: false, error: "제목을 입력해주세요." };
    }

    const sanitizedDescription = input.description
      ? input.description.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 1000)
      : null;

    // Upload file (student_id = null for distribution source)
    const uploadResult = await uploadDriveFile(formData, {
      tenantId,
      studentId: null,
      userId,
      uploaderRole: "admin",
      category: input.category,
      contextType: "distribution",
    });

    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error };
    }

    const fileId = uploadResult.file!.id;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DRIVE_EXPIRY_DAYS);

    const result: DistributeResult = {
      total: input.studentIds.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    await Promise.allSettled(
      input.studentIds.map(async (studentId) => {
        try {
          await repo.insertDistribution({
            tenant_id: tenantId,
            file_id: fileId,
            student_id: studentId,
            distributed_by: userId,
            title: sanitizedTitle,
            description: sanitizedDescription,
            expires_at: expiresAt.toISOString(),
          });
          result.succeeded++;
        } catch (err) {
          result.failed++;
          result.errors.push({
            studentId,
            error: err instanceof Error ? err.message : "알 수 없는 오류",
          });
        }
      })
    );

    return { success: true, result };
  } catch (err) {
    console.error("[Distribution] uploadAndDistribute error:", err);
    return { success: false, error: "자료 배포 중 오류가 발생했습니다." };
  }
}

// =============================================================================
// Revoke (Admin)
// =============================================================================

export async function revokeDistributionAction(
  distributionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return { success: false, error: "테넌트 정보가 없습니다." };
    }

    const dist = await repo.getDistributionById(distributionId);
    if (!dist || dist.tenant_id !== tenantId) {
      return { success: false, error: "배포를 찾을 수 없습니다." };
    }

    await repo.deleteDistribution(distributionId);
    return { success: true };
  } catch (err) {
    console.error("[Distribution] revoke error:", err);
    return { success: false, error: "배포 취소 중 오류가 발생했습니다." };
  }
}

// =============================================================================
// Tracking (Admin)
// =============================================================================

export async function getDistributionTrackingAction(
  fileId: string
): Promise<DistributionTracking[]> {
  try {
    await requireAdminOrConsultant();
    return await repo.getDistributionTracking(fileId);
  } catch (err) {
    console.error("[Distribution] getTracking error:", err);
    return [];
  }
}

// =============================================================================
// Admin Query (per-student distributions)
// =============================================================================

export async function getStudentDistributionsAdminAction(
  studentId: string
): Promise<{ distributions: FileDistribution[]; files: Record<string, DriveFile> }> {
  try {
    await requireAdminOrConsultant();
    const distributions = await repo.getDistributionsByStudent(studentId);
    const files: Record<string, DriveFile> = {};
    for (const dist of distributions) {
      if (!files[dist.file_id]) {
        const f = await repo.getFileById(dist.file_id);
        if (f) files[dist.file_id] = f;
      }
    }
    return { distributions, files };
  } catch (err) {
    console.error("[Distribution] getStudentDistributions error:", err);
    return { distributions: [], files: {} };
  }
}

// =============================================================================
// Student/Parent Query
// =============================================================================

export async function getMyDistributionsAction(
  studentId: string
): Promise<{ distributions: DistributionWithFile[]; signedUrls: Record<string, string> }> {
  try {
    await resolveAuthContext({ studentId });

    const rawDists = await repo.getDistributionsByStudent(studentId);
    if (rawDists.length === 0) {
      return { distributions: [], signedUrls: {} };
    }

    // Fetch linked files
    const fileIds = [...new Set(rawDists.map((d) => d.file_id))];
    const files: DriveFile[] = [];
    for (const fid of fileIds) {
      const f = await repo.getFileById(fid);
      if (f) files.push(f);
    }
    const fileMap = new Map(files.map((f) => [f.id, f]));

    // Generate signed URLs
    const urlMap = await storage.createSignedUrls(
      files.map((f) => f.storage_path)
    );
    const signedUrls: Record<string, string> = {};
    for (const f of files) {
      const url = urlMap.get(f.storage_path);
      if (url) signedUrls[f.id] = url;
    }

    const distributions: DistributionWithFile[] = rawDists
      .filter((d) => fileMap.has(d.file_id))
      .map((d) => ({
        ...d,
        file: fileMap.get(d.file_id)!,
        is_updated: d.viewed_at != null && d.updated_at > d.viewed_at,
      }));

    return { distributions, signedUrls };
  } catch (err) {
    console.error("[Distribution] getMyDistributions error:", err);
    return { distributions: [], signedUrls: {} };
  }
}

// =============================================================================
// View/Download Tracking (Student/Parent)
// =============================================================================

export async function markDistributionViewedAction(
  distributionId: string
): Promise<void> {
  try {
    const dist = await repo.getDistributionById(distributionId);
    if (!dist) return;
    await resolveAuthContext({ studentId: dist.student_id });
    await repo.updateDistributionViewed(distributionId);
  } catch {
    // Silent fail — tracking is non-critical
  }
}

export async function markDistributionDownloadedAction(
  distributionId: string
): Promise<void> {
  try {
    const dist = await repo.getDistributionById(distributionId);
    if (!dist) return;
    await resolveAuthContext({ studentId: dist.student_id });
    await repo.updateDistributionDownloaded(distributionId);
  } catch {
    // Silent fail — tracking is non-critical
  }
}
