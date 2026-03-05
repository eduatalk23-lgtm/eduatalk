/**
 * Drive File Validation
 * 파일 크기, 타입 검증
 */

import {
  DRIVE_ALLOWED_MIME_TYPES,
  DRIVE_MAX_FILE_SIZE,
} from "./types";

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 드라이브 파일 검증
 */
export function validateDriveFile(
  file: { size: number; type: string; name: string },
  allowedMimeTypes?: string[] | null
): FileValidationResult {
  if (file.size <= 0) {
    return { valid: false, error: "빈 파일은 업로드할 수 없습니다." };
  }

  if (file.size > DRIVE_MAX_FILE_SIZE) {
    const maxMB = Math.floor(DRIVE_MAX_FILE_SIZE / 1024 / 1024);
    return { valid: false, error: `파일은 ${maxMB}MB 이하여야 합니다.` };
  }

  // 워크플로우 요청에서 허용 타입이 지정된 경우 해당 타입만 허용
  const allowed = allowedMimeTypes?.length
    ? allowedMimeTypes
    : (DRIVE_ALLOWED_MIME_TYPES as readonly string[]);

  if (!allowed.includes(file.type)) {
    return { valid: false, error: "지원하지 않는 파일 형식입니다." };
  }

  return { valid: true };
}

/**
 * 이미지 파일 여부 확인
 */
export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * 파일명 안전하게 정리 (특수문자 제거)
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w\s.\-가-힣ㄱ-ㅎㅏ-ㅣ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 100);
}

/**
 * MIME 타입에 대응하는 파일 타입 라벨
 */
export function getFileTypeLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "이미지";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("word")) return "Word";
  if (mimeType.includes("hwp")) return "HWP";
  return "파일";
}

/**
 * 사람이 읽기 좋은 파일 크기 문자열
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
