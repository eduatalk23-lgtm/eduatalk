/**
 * 성능 로깅 유틸리티
 * NEXT_PUBLIC_PERF_DEBUG=true일 때만 상세 로그 출력
 */

const PERF_DEBUG =
  process.env.NEXT_PUBLIC_PERF_DEBUG === "true" ||
  process.env.NODE_ENV === "development";

/**
 * 타이머 상태 추적을 위한 Map
 * 같은 라벨로 여러 번 호출되는 것을 방지
 */
const activeTimers = new Map<string, number>();

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
    // 고유한 라벨 생성 (중복 방지)
    const uniqueLabel = `${label}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    console.time(uniqueLabel);
    try {
      msOrFn();
    } finally {
      console.timeEnd(uniqueLabel);
    }
  }
}

/**
 * 성능 타이머 (디버그 모드에서만)
 * 서버 컴포넌트 환경에서도 안전하게 동작하도록 항상 고유한 라벨을 생성합니다.
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

  // 항상 고유한 라벨 생성 (타임스탬프 + 랜덤 문자열)
  // 서버 컴포넌트에서 각 요청마다 새로운 컨텍스트가 생성되므로
  // activeTimers Map에 의존하지 않고 항상 고유한 라벨을 생성
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  const uniqueLabel = `${label}_${timestamp}_${randomStr}`;

  let timerStarted = false;
  try {
    console.time(uniqueLabel);
    timerStarted = true;
  } catch (error) {
    // console.time이 실패해도 계속 진행
    console.warn(`[perfTime] Failed to start timer for "${uniqueLabel}":`, error);
  }

  return {
    end() {
      if (timerStarted) {
        try {
          console.timeEnd(uniqueLabel);
        } catch (error) {
          // console.timeEnd가 실패해도 무시 (타이머가 시작되지 않았을 수 있음)
          // 개발 환경에서만 경고 출력
          if (process.env.NODE_ENV === "development") {
            console.warn(
              `[perfTime] Failed to end timer for "${uniqueLabel}":`,
              error
            );
          }
        }
      }
    },
  };
}

