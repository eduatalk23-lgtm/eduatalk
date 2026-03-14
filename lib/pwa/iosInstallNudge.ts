/**
 * iOS 홈 화면 추가 유도 유틸리티.
 *
 * iOS Safari에서 PWA가 설치되지 않은 경우(non-standalone),
 * 컨텍스트에 맞는 설치 유도 모달을 트리거합니다.
 *
 * 사용:
 *   triggerIOSInstallNudge("chat");   // 채팅 알림 수신 시
 *   triggerIOSInstallNudge("reminder"); // 리마인더 관련 액션 시
 */

export type IOSNudgeContext = "chat" | "reminder" | "general";

const STORAGE_KEY = "ios-install-nudge";
const DISMISS_COUNT_KEY = "ios-install-nudge-dismiss-count";
const SNOOZE_DAYS = 1;
const MAX_DISMISSALS = 3;
const LONG_SNOOZE_DAYS = 30;

/** iOS + 비-standalone 환경인지 확인 */
export function isIOSNonStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;
  return isIOS && !isStandalone;
}

/** snooze 중인지 확인 */
function isSnoozed(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const dismissedAt = parseInt(raw, 10);
  if (isNaN(dismissedAt)) return false;
  const count = parseInt(
    localStorage.getItem(DISMISS_COUNT_KEY) ?? "0",
    10
  );
  const snoozeDays = count >= MAX_DISMISSALS ? LONG_SNOOZE_DAYS : SNOOZE_DAYS;
  return Date.now() - dismissedAt < snoozeDays * 24 * 60 * 60 * 1000;
}

/** 세션 내 이미 표시했는지 확인 (탭 단위) */
const shownThisSession = new Set<string>();

/**
 * iOS 설치 유도 모달을 트리거합니다.
 *
 * 조건:
 * - iOS Safari (non-standalone)
 * - snooze 기간이 아닌 경우
 * - 현재 세션에서 해당 컨텍스트로 표시한 적 없는 경우
 */
export function triggerIOSInstallNudge(context: IOSNudgeContext): void {
  if (!isIOSNonStandalone()) return;
  if (isSnoozed()) return;
  if (shownThisSession.has(context)) return;

  shownThisSession.add(context);
  window.dispatchEvent(
    new CustomEvent("ios-install-nudge", { detail: { context } })
  );
}

/** 닫기 시 snooze 기록 */
export function dismissIOSNudge(): void {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
  const count = parseInt(
    localStorage.getItem(DISMISS_COUNT_KEY) ?? "0",
    10
  );
  localStorage.setItem(DISMISS_COUNT_KEY, String(count + 1));
}
