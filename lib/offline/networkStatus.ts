/**
 * Network Status Detection
 *
 * 네트워크 연결 상태를 감지하고 이벤트를 발생시킵니다.
 */

type NetworkStatusListener = (isOnline: boolean) => void;

const listeners: Set<NetworkStatusListener> = new Set();

/**
 * 현재 네트워크 연결 상태
 */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") {
    return true; // SSR 환경에서는 온라인으로 가정
  }
  return navigator.onLine;
}

/**
 * 네트워크 상태 변경 리스너 등록
 */
export function addNetworkStatusListener(
  listener: NetworkStatusListener
): () => void {
  listeners.add(listener);

  // 초기 상태 전달
  listener(isOnline());

  // 구독 해제 함수 반환
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 네트워크 상태 변경 이벤트 핸들러
 */
function handleOnline() {
  listeners.forEach((listener) => listener(true));
}

function handleOffline() {
  listeners.forEach((listener) => listener(false));
}

/**
 * 네트워크 상태 이벤트 리스너 초기화
 */
export function initNetworkStatusListeners(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
}

/**
 * 네트워크 상태 이벤트 리스너 정리
 */
export function cleanupNetworkStatusListeners(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
}

/**
 * 네트워크 연결 대기 (최대 대기 시간 지정 가능)
 */
export function waitForOnline(timeoutMs: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    if (isOnline()) {
      resolve(true);
      return;
    }

    let timeoutId: NodeJS.Timeout | null = null;
    let unsubscribe: (() => void) | null = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };

    unsubscribe = addNetworkStatusListener((online) => {
      if (online) {
        cleanup();
        resolve(true);
      }
    });

    timeoutId = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
  });
}

/**
 * 네트워크 오류인지 확인
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("connection") ||
      message.includes("offline") ||
      message.includes("timeout") ||
      message.includes("failed to fetch") ||
      error.name === "NetworkError" ||
      error.name === "TypeError" // fetch 실패 시 TypeError 발생
    );
  }
  return false;
}
