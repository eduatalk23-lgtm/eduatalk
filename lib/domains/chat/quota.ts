/**
 * Chat Storage Quota
 * 역할별 스토리지 한도 정의 및 쿼터 체크 유틸리티
 */

export interface StorageQuotaInfo {
  usedBytes: number;
  totalBytes: number;
  remainingBytes: number;
  usagePercent: number;
}

/** 역할별 스토리지 한도 (bytes) */
const STORAGE_LIMITS: Record<string, number> = {
  student: 500 * 1024 * 1024,         // 500MB
  admin: 2 * 1024 * 1024 * 1024,      // 2GB
  consultant: 2 * 1024 * 1024 * 1024, // 2GB
  superadmin: 5 * 1024 * 1024 * 1024, // 5GB
  parent: 200 * 1024 * 1024,          // 200MB
};

const DEFAULT_LIMIT = 500 * 1024 * 1024; // 500MB

/** 역할별 스토리지 한도 조회 */
export function getStorageLimitForRole(role: string | null): number {
  if (!role) return DEFAULT_LIMIT;
  return STORAGE_LIMITS[role] ?? DEFAULT_LIMIT;
}

/** 쿼터 초과 확인 */
export function isQuotaExceeded(
  currentUsageBytes: number,
  newFileBytes: number,
  limitBytes: number
): boolean {
  return currentUsageBytes + newFileBytes > limitBytes;
}

/** 사람이 읽기 좋은 용량 포맷 */
export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}
