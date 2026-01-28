/**
 * 카운터 기반 스크롤 잠금 유틸리티
 *
 * 여러 컴포넌트(Modal, Dialog, Popover 등)가 동시에 body 스크롤을 잠글 때
 * 충돌을 방지합니다. 모든 잠금이 해제되어야 스크롤이 복원됩니다.
 */

let lockCount = 0;
let originalOverflow = "";

/**
 * body 스크롤을 잠급니다.
 * 여러 번 호출해도 안전하며, 동일한 횟수만큼 unlock을 호출해야 스크롤이 복원됩니다.
 */
export function lockScroll(): void {
  if (typeof document === "undefined") return;

  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount++;
}

/**
 * body 스크롤 잠금을 해제합니다.
 * 모든 잠금이 해제되어야 실제로 스크롤이 복원됩니다.
 */
export function unlockScroll(): void {
  if (typeof document === "undefined") return;

  lockCount = Math.max(0, lockCount - 1);

  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow;
  }
}

/**
 * 현재 스크롤 잠금 카운트를 반환합니다.
 * (디버깅 용도)
 */
export function getScrollLockCount(): number {
  return lockCount;
}
