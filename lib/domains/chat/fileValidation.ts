import {
  ALLOWED_FILE_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_FILE_SIZE,
  type AttachmentType,
} from "./types";

/** 파일 검증 결과 */
interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/** 채팅 파일 검증 */
export function validateChatFile(file: File): FileValidationResult {
  if (file.size <= 0) {
    return { valid: false, error: "빈 파일은 전송할 수 없습니다." };
  }

  if (file.size > MAX_FILE_SIZE) {
    const maxMB = Math.floor(MAX_FILE_SIZE / 1024 / 1024);
    return { valid: false, error: `파일은 ${maxMB}MB 이하여야 합니다.` };
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type as (typeof ALLOWED_FILE_TYPES)[number])) {
    return { valid: false, error: "지원하지 않는 파일 형식입니다." };
  }

  return { valid: true };
}

/** 파일 목록 검증 (개수 제한) */
export function validateChatFiles(files: File[]): FileValidationResult {
  if (files.length === 0) {
    return { valid: false, error: "파일을 선택해주세요." };
  }

  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return {
      valid: false,
      error: `파일은 최대 ${MAX_ATTACHMENTS_PER_MESSAGE}개까지 첨부할 수 있습니다.`,
    };
  }

  for (const file of files) {
    const result = validateChatFile(file);
    if (!result.valid) {
      return { valid: false, error: `${file.name}: ${result.error}` };
    }
  }

  return { valid: true };
}

/** MIME 타입으로 첨부파일 분류 */
export function getAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

/** 이미지 파일 여부 확인 */
export function isImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_TYPES)[number]);
}

/** 파일명 안전하게 정리 (특수문자 제거) */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w\s.\-가-힣ㄱ-ㅎㅏ-ㅣ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 100);
}

/** 사람이 읽기 좋은 파일 크기 문자열 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** MIME 타입에 대응하는 파일 확장자 아이콘 라벨 */
export function getFileTypeLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "이미지";
  if (mimeType.startsWith("video/")) return "동영상";
  if (mimeType.startsWith("audio/")) return "오디오";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("word")) return "Word";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "Excel";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "PPT";
  if (mimeType.includes("hwp")) return "HWP";
  return "파일";
}
