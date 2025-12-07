/**
 * 성능 로깅 유틸리티
 * NEXT_PUBLIC_PERF_DEBUG=true일 때만 상세 로그 출력
 */

const PERF_DEBUG =
  process.env.NEXT_PUBLIC_PERF_DEBUG === "true" ||
  process.env.NODE_ENV === "development";

/**
 * 성능 로그 출력 (디버그 모드에서만)
 * @param label 로그 레이블
 * @param msOrFn 시간(ms) 또는 실행할 함수
 */
export function perfLog(label: string, msOrFn?: number | (() => void)) {
  if (!PERF_DEBUG) return;

  if (typeof msOrFn === "number") {
    console.log(`${label}: ${msOrFn.toFixed(3)}ms`);
    return;
  }

  if (typeof msOrFn === "function") {
    console.time(label);
    try {
      msOrFn();
    } finally {
      console.timeEnd(label);
    }
  }
}

/**
 * 성능 타이머 (디버그 모드에서만)
 * @param label 타이머 레이블
 * @returns end() 메서드를 가진 객체
 */
export function perfTime(label: string) {
  if (!PERF_DEBUG) {
    return {
      end() {
        // 디버그 모드가 아니면 아무것도 하지 않음
      },
    };
  }

  console.time(label);
  return {
    end() {
      console.timeEnd(label);
    },
  };
}

