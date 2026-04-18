/**
 * Phase B-6: composer 첨부 파일 제약/검증
 *
 * 현재 로컬 Gemma 4 8B 는 비전 미지원 → 첨부는 전송되지만 LLM 해석은 후속(모델 결정)
 * 단계에서 연결. 인프라(피커·paste·drag-drop·전송 파이프)만 여기서 마무리.
 */

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const ACCEPT_ATTRIBUTE = ACCEPTED_ATTACHMENT_TYPES.join(",");

export type AttachmentRejectionReason =
  | "too_many"
  | "too_large"
  | "unsupported_type";

export type AttachmentValidation = {
  accepted: File[];
  rejected: Array<{ file: File; reason: AttachmentRejectionReason }>;
};

export function validateAttachments(
  existing: File[],
  incoming: File[],
): AttachmentValidation {
  const accepted: File[] = [];
  const rejected: AttachmentValidation["rejected"] = [];

  let slot = Math.max(0, MAX_ATTACHMENTS - existing.length);
  for (const file of incoming) {
    if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
      rejected.push({ file, reason: "unsupported_type" });
      continue;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      rejected.push({ file, reason: "too_large" });
      continue;
    }
    if (slot <= 0) {
      rejected.push({ file, reason: "too_many" });
      continue;
    }
    accepted.push(file);
    slot -= 1;
  }
  return { accepted, rejected };
}

export function rejectionMessage(reason: AttachmentRejectionReason): string {
  switch (reason) {
    case "too_many":
      return `첨부는 최대 ${MAX_ATTACHMENTS}개까지 가능합니다.`;
    case "too_large":
      return `파일 크기 제한은 ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB 입니다.`;
    case "unsupported_type":
      return "지원하는 이미지 형식이 아닙니다 (PNG/JPEG/WebP/GIF).";
  }
}
