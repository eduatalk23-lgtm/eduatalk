import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionWarn } from "@/lib/logging/actionLogger";

/**
 * is_active 변경 시 Supabase Auth ban_duration 동기화 (역할 무관, 범용)
 * - false → ban_duration: '876000h' (약 100년)
 * - true  → ban_duration: 'none'
 *
 * ban_duration 설정 시 새 로그인과 토큰 갱신이 차단됨.
 * 기존 세션은 만료(기본 1시간) 시 자연 종료되며,
 * 레이아웃 is_active 체크로 즉시 리다이렉트 처리.
 *
 * 실패 시 경고만 로깅 (non-fatal). DB의 is_active가 SSOT.
 */
export async function syncAuthBanStatus(
  userId: string,
  isActive: boolean
): Promise<boolean> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    logActionWarn(
      { domain: "auth", action: "syncAuthBanStatus" },
      "Admin 클라이언트 생성 실패 — ban 동기화 건너뜀",
      { userId, isActive }
    );
    return false;
  }

  try {
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { ban_duration: isActive ? "none" : "876000h" }
    );

    if (updateError) {
      logActionWarn(
        { domain: "auth", action: "syncAuthBanStatus" },
        `ban_duration 업데이트 실패: ${updateError.message}`,
        { userId, isActive }
      );
      return false;
    }

    return true;
  } catch (error) {
    logActionWarn(
      { domain: "auth", action: "syncAuthBanStatus" },
      `ban 동기화 중 예외: ${error instanceof Error ? error.message : String(error)}`,
      { userId, isActive }
    );
    return false;
  }
}

/**
 * 벌크 ban 동기화 (Promise.allSettled — 개별 실패가 전체에 영향 없음)
 */
export async function bulkSyncAuthBanStatus(
  userIds: string[],
  isActive: boolean
): Promise<void> {
  if (userIds.length === 0) return;

  const results = await Promise.all(
    userIds.map((id) => syncAuthBanStatus(id, isActive))
  );

  const failedCount = results.filter((ok) => !ok).length;
  if (failedCount > 0) {
    logActionWarn(
      { domain: "auth", action: "bulkSyncAuthBanStatus" },
      `${failedCount}/${userIds.length}건 ban 동기화 실패`,
      { isActive }
    );
  }
}
