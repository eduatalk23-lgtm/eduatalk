/**
 * Drive Upload Service
 * 파일 업로드 핵심 로직 (Server Action이 아닌 순수 서버 함수)
 */

import { verifyMimeType } from "@/lib/domains/chat/mimeVerification";
import * as repo from "../repository";
import * as storage from "../storage";
import { getStudentDriveUsage, isQuotaExceeded } from "../quota";
import { validateDriveFile, sanitizeFileName } from "../validation";
import {
  DRIVE_EXPIRY_DAYS,
  type FileCategory,
  type DriveFile,
  type UploaderRole,
} from "../types";

export interface UploadOptions {
  tenantId: string;
  studentId: string | null;
  userId: string;
  uploaderRole: UploaderRole;
  category: FileCategory;
  contextType?: "drive" | "workflow" | "distribution";
  contextId?: string;
  versionGroupId?: string;
}

export interface UploadResult {
  success: boolean;
  file?: DriveFile;
  signedUrl?: string;
  error?: string;
}

export async function uploadDriveFile(
  formData: FormData,
  options: UploadOptions
): Promise<UploadResult> {
  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "파일이 없습니다." };

  // 1. 파일 검증
  const validation = validateDriveFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 2. MIME magic bytes 검증
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeOk = await verifyMimeType(buffer, file.type);
  if (!mimeOk) {
    return { success: false, error: "파일 형식이 올바르지 않습니다." };
  }

  // 3. 쿼터 확인 (배포 파일은 학생 쿼터에 포함하지 않음)
  if (options.studentId) {
    const currentUsage = await getStudentDriveUsage(options.studentId);
    if (isQuotaExceeded(currentUsage, file.size)) {
      return { success: false, error: "스토리지 용량이 부족합니다." };
    }
  }

  // 4. 버전 번호 결정
  let versionNumber = 1;
  const versionGroupId = options.versionGroupId ?? crypto.randomUUID();
  if (options.versionGroupId) {
    const existing = await repo.getFilesByVersionGroup(options.versionGroupId);
    versionNumber = existing.length + 1;
  }

  // 5. Storage 업로드
  const safeName = sanitizeFileName(file.name);
  const ownerDir = options.studentId ?? "_shared";
  const storagePath = `${options.tenantId}/${ownerDir}/${options.contextType ?? "drive"}/${crypto.randomUUID()}_${safeName}`;

  const uploaded = await storage.uploadFile(storagePath, buffer, file.type);
  if (!uploaded) {
    return { success: false, error: "파일 업로드에 실패했습니다." };
  }

  // 6. 만료일 계산
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DRIVE_EXPIRY_DAYS);

  // 7. DB 레코드 생성 + 용처 연결 (실패 시 스토리지 정리)
  let driveFile: DriveFile;
  try {
    const fileData = {
      tenant_id: options.tenantId,
      uploaded_by: options.userId,
      uploaded_by_role: options.uploaderRole,
      original_name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      category: options.category,
      version_group_id: versionGroupId,
      version_number: versionNumber,
      expires_at: expiresAt.toISOString(),
    };

    if (options.studentId) {
      driveFile = await repo.insertFile({ ...fileData, student_id: options.studentId });
    } else {
      driveFile = await repo.insertDistributionSourceFile({ ...fileData, student_id: null });
    }

    // 8. 용처 연결
    await repo.insertFileContext({
      file_id: driveFile.id,
      context_type: options.contextType ?? "drive",
      context_id: options.contextId ?? null,
    });
  } catch (dbError) {
    // DB 실패 시 스토리지 고아 파일 정리
    await storage.deleteFiles([storagePath]).catch(() => {});
    throw dbError;
  }

  // 9. signed URL 생성
  const signedUrl = await storage.createSignedUrl(storagePath);

  return { success: true, file: driveFile, signedUrl: signedUrl ?? undefined };
}
