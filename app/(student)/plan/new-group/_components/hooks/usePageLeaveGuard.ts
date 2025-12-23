"use client";

/**
 * UX-3: 페이지 이탈 방지 훅
 *
 * 저장되지 않은 변경 사항이 있을 때 페이지를 떠나려고 하면
 * 경고 다이얼로그를 표시합니다.
 */

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export type UsePageLeaveGuardOptions = {
  /** 이탈 방지 활성화 여부 */
  enabled: boolean;
  /** 경고 메시지 */
  message?: string;
  /** 이탈 확인 콜백 (true 반환 시 이탈 허용) */
  onConfirmLeave?: () => Promise<boolean> | boolean;
};

const DEFAULT_MESSAGE =
  "저장하지 않은 변경사항이 있습니다. 정말 페이지를 떠나시겠습니까?";

/**
 * 페이지 이탈 방지 훅
 *
 * @example
 * ```tsx
 * function PlanWizard() {
 *   const { isDirty } = usePlanWizard();
 *
 *   usePageLeaveGuard({
 *     enabled: isDirty,
 *     message: "작성 중인 플랜이 저장되지 않았습니다.",
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function usePageLeaveGuard({
  enabled,
  message = DEFAULT_MESSAGE,
  onConfirmLeave,
}: UsePageLeaveGuardOptions): void {
  // 브라우저 새로고침/닫기 방지
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 최신 브라우저에서는 returnValue 설정이 필요
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, message]);

  // Next.js 라우터 네비게이션 방지
  // Note: App Router에서는 beforePopState가 없으므로
  // popstate 이벤트와 history API를 직접 사용
  useEffect(() => {
    if (!enabled) return;

    const handlePopState = async (e: PopStateEvent) => {
      if (onConfirmLeave) {
        const confirmed = await onConfirmLeave();
        if (!confirmed) {
          // 뒤로가기 취소: 현재 URL로 다시 push
          window.history.pushState(null, "", window.location.href);
        }
      } else {
        const confirmed = window.confirm(message);
        if (!confirmed) {
          window.history.pushState(null, "", window.location.href);
        }
      }
    };

    // 현재 상태를 history에 push하여 뒤로가기 감지 준비
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled, message, onConfirmLeave]);
}

/**
 * 안전한 네비게이션 함수를 제공하는 훅
 *
 * isDirty 상태를 확인하고 필요시 확인 다이얼로그를 표시합니다.
 */
export function useSafeNavigation(isDirty: boolean, message?: string) {
  const router = useRouter();

  const safeNavigate = useCallback(
    async (path: string): Promise<boolean> => {
      if (!isDirty) {
        router.push(path);
        return true;
      }

      const confirmed = window.confirm(
        message || DEFAULT_MESSAGE
      );

      if (confirmed) {
        router.push(path);
        return true;
      }

      return false;
    },
    [isDirty, message, router]
  );

  const safeBack = useCallback(async (): Promise<boolean> => {
    if (!isDirty) {
      router.back();
      return true;
    }

    const confirmed = window.confirm(
      message || DEFAULT_MESSAGE
    );

    if (confirmed) {
      router.back();
      return true;
    }

    return false;
  }, [isDirty, message, router]);

  return {
    safeNavigate,
    safeBack,
  };
}

export default usePageLeaveGuard;
