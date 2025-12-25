/**
 * useBeforeUnload Hook
 * 페이지 이탈 시 경고 메시지를 표시합니다.
 *
 * @param shouldWarn - 경고를 표시할지 여부 (예: isDirty 상태)
 * @param message - 일부 브라우저에서 표시될 수 있는 메시지 (대부분의 모던 브라우저에서는 무시됨)
 */

import { useEffect } from "react";

export function useBeforeUnload(
  shouldWarn: boolean,
  message: string = "변경사항이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?"
): void {
  useEffect(() => {
    if (!shouldWarn) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 표준에 따라 메시지를 설정해야 함
      e.preventDefault();
      e.returnValue = message; // Chrome에서는 빈 문자열이 필요
      return message; // 일부 브라우저에서는 반환값 필요
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldWarn, message]);
}
