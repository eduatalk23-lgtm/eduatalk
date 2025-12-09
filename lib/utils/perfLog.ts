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
 * 중복 라벨 호출을 방지하기 위해 타이머 상태를 추적합니다.
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

  // 이미 활성화된 타이머가 있는지 확인
  const activeCount = activeTimers.get(label) || 0;
  
  // 중복 호출 방지: 같은 라벨로 이미 시작된 타이머가 있으면 고유한 라벨 생성
  const uniqueLabel = activeCount > 0 
    ? `${label}_${activeCount + 1}`
    : label;

  // 타이머 카운트 증가
  activeTimers.set(label, activeCount + 1);

  let timerStarted = false;
  try {
    console.time(uniqueLabel);
    timerStarted = true;
  } catch (error) {
    // console.time이 실패해도 계속 진행
    console.warn(`[perfTime] Failed to start timer for "${uniqueLabel}":`, error);
    activeTimers.set(label, activeCount); // 실패 시 카운트 복원
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
        } finally {
          // 타이머 종료 시 카운트 감소
          const currentCount = activeTimers.get(label) || 0;
          if (currentCount > 0) {
            activeTimers.set(label, currentCount - 1);
          } else {
            activeTimers.delete(label);
          }
        }
      } else {
        // 타이머가 시작되지 않았어도 카운트 감소
        const currentCount = activeTimers.get(label) || 0;
        if (currentCount > 0) {
          activeTimers.set(label, currentCount - 1);
        } else {
          activeTimers.delete(label);
        }
      }
    },
  };
}

