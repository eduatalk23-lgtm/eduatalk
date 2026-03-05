/**
 * Drive Storage Quota
 * 학생별 50MB 한도 관리
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** 학생별 스토리지 한도 (bytes) - 50MB */
export const DRIVE_STORAGE_LIMIT = 50 * 1024 * 1024;

export interface DriveQuotaInfo {
  usedBytes: number;
  totalBytes: number;
  remainingBytes: number;
  usagePercent: number;
}

/**
 * 학생의 현재 드라이브 사용량 조회
 * DB 에러 시 throw하여 업로드 차단 (0 반환 시 쿼터 우회 가능)
 */
export async function getStudentDriveUsage(studentId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("[DriveQuota] Admin client not available");

  const { data, error } = await supabase
    .from("files")
    .select("size_bytes")
    .eq("student_id", studentId);

  if (error) {
    throw new Error(`[DriveQuota] getStudentDriveUsage error: ${error.message}`);
  }

  return (data ?? []).reduce((sum: number, f: { size_bytes: number }) => sum + (f.size_bytes ?? 0), 0);
}

/**
 * 학생의 드라이브 쿼터 정보 조회
 */
export async function getStudentDriveQuota(
  studentId: string
): Promise<DriveQuotaInfo> {
  const usedBytes = await getStudentDriveUsage(studentId);
  const totalBytes = DRIVE_STORAGE_LIMIT;
  const remainingBytes = Math.max(totalBytes - usedBytes, 0);
  const usagePercent =
    totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

  return { usedBytes, totalBytes, remainingBytes, usagePercent };
}

/**
 * 쿼터 초과 확인
 */
export function isQuotaExceeded(
  currentUsageBytes: number,
  newFileBytes: number
): boolean {
  return currentUsageBytes + newFileBytes > DRIVE_STORAGE_LIMIT;
}

/**
 * 사람이 읽기 좋은 용량 포맷
 */
export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}
