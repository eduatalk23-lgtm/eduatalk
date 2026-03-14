"use client";

import { useEffect, useRef } from "react";

/**
 * CLS(Cumulative Layout Shift) 자동 모니터링 훅
 *
 * 개발 모드에서만 활성화. PerformanceObserver로 layout-shift 이벤트를 감지하여
 * 지정된 컨테이너 내에서 발생하는 CLS를 추적하고 콘솔에 경고합니다.
 *
 * @param containerRef - 모니터링 대상 컨테이너 ref
 * @param label - 콘솔 로그에 표시할 라벨 (기본: "CLS Monitor")
 */
export function useCLSMonitor(
  containerRef: React.RefObject<HTMLElement | null>,
  label = "CLS Monitor"
) {
  const cumulativeCLS = useRef(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (typeof PerformanceObserver === "undefined") return;

    let observer: PerformanceObserver | null = null;

    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const lsEntry = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
            sources?: Array<{ node?: Node }>;
          };

          // 사용자 입력에 의한 시프트는 무시
          if (lsEntry.hadRecentInput) continue;

          const value = lsEntry.value ?? 0;
          if (value === 0) continue;

          // 컨테이너 내부 요소인지 확인
          const container = containerRef.current;
          if (!container) continue;

          const isInContainer = lsEntry.sources?.some(
            (source) => source.node && container.contains(source.node)
          );

          if (!isInContainer && lsEntry.sources && lsEntry.sources.length > 0) continue;

          cumulativeCLS.current += value;

          if (cumulativeCLS.current > 0.1) {
            console.warn(
              `[${label}] CLS 누적 ${cumulativeCLS.current.toFixed(4)} (임계값 0.1 초과)`,
              {
                shift: value.toFixed(4),
                sources: lsEntry.sources?.map((s) => s.node),
              }
            );
          } else if (value > 0.01) {
            console.debug(
              `[${label}] layout-shift ${value.toFixed(4)} (누적: ${cumulativeCLS.current.toFixed(4)})`,
            );
          }
        }
      });

      observer.observe({ type: "layout-shift", buffered: true });
    } catch {
      // PerformanceObserver layout-shift 미지원 브라우저
    }

    return () => {
      observer?.disconnect();
    };
  }, [containerRef, label]);
}
