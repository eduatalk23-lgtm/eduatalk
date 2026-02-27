import { useState, useEffect } from "react";

/**
 * 짧은 로딩(< delay ms)에서 스피너 깜빡임을 방지하는 훅.
 *
 * `isPending`은 즉시 true가 되어 버튼 disabled 처리에 사용하고,
 * `showLoading`은 delay ms 후에 true가 되어 스피너 표시에 사용합니다.
 *
 * @example
 * ```tsx
 * const showSpinner = useDelayedLoading(isPending, 500);
 * <Button disabled={isPending} isLoading={showSpinner}>저장</Button>
 * ```
 */
export function useDelayedLoading(isPending: boolean, delay = 500): boolean {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!isPending) return;

    const timer = setTimeout(() => setShowLoading(true), delay);
    return () => {
      clearTimeout(timer);
      setShowLoading(false);
    };
  }, [isPending, delay]);

  return isPending && showLoading;
}
