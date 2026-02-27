/**
 * 첨부파일 만료 계산 유틸리티
 *
 * cleanup.ts의 EXPIRY_THRESHOLD_DAYS = 7과 동기화하여
 * 사용자에게 만료 시점을 안내하는 UI용 헬퍼.
 */

/** 첨부파일 자동 삭제까지의 일수 (cleanup.ts와 동기화) */
export const ATTACHMENT_EXPIRY_DAYS = 7;

/** D-day 경고를 표시하기 시작하는 남은 일수 */
export const EXPIRY_WARNING_THRESHOLD = 3;

export type ExpiryLevel = "safe" | "warning" | "critical";

export interface AttachmentExpiryInfo {
  daysLeft: number;
  level: ExpiryLevel;
  label: string;
}

/**
 * 첨부파일의 만료 정보를 계산
 * @param createdAt 첨부파일 생성일 (ISO 8601)
 */
export function getAttachmentExpiryInfo(createdAt: string): AttachmentExpiryInfo {
  const created = new Date(createdAt);
  created.setHours(0, 0, 0, 0);

  const expiry = new Date(created);
  expiry.setDate(expiry.getDate() + ATTACHMENT_EXPIRY_DAYS);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 1) {
    return {
      daysLeft: Math.max(daysLeft, 0),
      level: "critical",
      label: daysLeft <= 0 ? "오늘 삭제" : "D-1",
    };
  }

  if (daysLeft <= EXPIRY_WARNING_THRESHOLD) {
    return {
      daysLeft,
      level: "warning",
      label: `D-${daysLeft}`,
    };
  }

  return { daysLeft, level: "safe", label: "" };
}

/**
 * 만료 뱃지를 표시해야 하는지 여부
 */
export function shouldShowExpiryBadge(createdAt: string): boolean {
  const info = getAttachmentExpiryInfo(createdAt);
  return info.level !== "safe";
}
