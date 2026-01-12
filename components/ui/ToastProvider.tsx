"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo, useRef } from "react";
import { Toast } from "../molecules/Toast";

type ToastType = "success" | "error" | "info" | "warning";

type ToastMessage = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  showWarning: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// 최대 동시 표시 개수
const MAX_VISIBLE_TOASTS = 3;
// 중복 메시지 방지 시간 (ms)
const DUPLICATE_PREVENTION_MS = 2000;

// UUID 생성 헬퍼 (crypto.randomUUID 폴백 포함)
function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // 폴백: 간단한 UUID-like 문자열 생성
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const queueRef = useRef<ToastMessage[]>([]);

  // 최근 메시지 추적 (중복 방지용)
  const recentMessagesRef = useRef<Map<string, number>>(new Map());

  // 큐에서 다음 토스트 표시 (토스트 삭제 시 호출)
  const processQueue = useCallback(() => {
    if (queueRef.current.length > 0) {
      const [nextToast, ...remainingQueue] = queueRef.current;
      queueRef.current = remainingQueue;
      setToasts((prev) => {
        if (prev.length < MAX_VISIBLE_TOASTS) {
          return [...prev, nextToast];
        }
        return prev;
      });
    }
  }, []);

  // 오래된 중복 방지 기록 정리
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const map = recentMessagesRef.current;
      for (const [key, timestamp] of map.entries()) {
        if (now - timestamp > DUPLICATE_PREVENTION_MS) {
          map.delete(key);
        }
      }
    }, DUPLICATE_PREVENTION_MS);

    return () => clearInterval(cleanup);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    // 토스트 삭제 후 큐 처리 (약간의 딜레이로 애니메이션 완료 후 처리)
    setTimeout(processQueue, 100);
  }, [processQueue]);

  const showToast = useCallback(
    (message: string, type: ToastType = "success", duration = 3000) => {
      // 중복 메시지 확인 (같은 메시지 + 같은 타입)
      const messageKey = `${type}:${message}`;
      const lastShown = recentMessagesRef.current.get(messageKey);
      const now = Date.now();

      if (lastShown && now - lastShown < DUPLICATE_PREVENTION_MS) {
        // 중복 메시지 무시
        return;
      }

      // 메시지 기록
      recentMessagesRef.current.set(messageKey, now);

      const id = generateId();
      const newToast: ToastMessage = { id, message, type, duration };

      // 현재 표시된 토스트가 최대치 미만이면 바로 표시
      setToasts((prev) => {
        if (prev.length < MAX_VISIBLE_TOASTS) {
          return [...prev, newToast];
        }
        // 최대치면 큐에 추가 (ref 사용)
        queueRef.current = [...queueRef.current, newToast];
        return prev;
      });
    },
    []
  );

  const showSuccess = useCallback(
    (message: string) => showToast(message, "success"),
    [showToast]
  );

  const showError = useCallback(
    (message: string) => showToast(message, "error", 5000),
    [showToast]
  );

  const showInfo = useCallback(
    (message: string) => showToast(message, "info"),
    [showToast]
  );

  const showWarning = useCallback(
    (message: string) => showToast(message, "warning"),
    [showToast]
  );

  // Context value를 메모이제이션하여 불필요한 리렌더링 방지
  const contextValue = useMemo(
    () => ({
      showToast,
      showSuccess,
      showError,
      showInfo,
      showWarning,
    }),
    [showToast, showSuccess, showError, showInfo, showWarning]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            variant={toast.type === "success" ? "success" : toast.type === "error" ? "error" : toast.type === "warning" ? "warning" : "info"}
            duration={toast.duration}
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    // 개발 환경에서만 에러를 던지고, 프로덕션에서는 기본 동작 제공
    if (process.env.NODE_ENV === "development") {
      console.error("useToast must be used within a ToastProvider");
    }
    // 기본 동작 제공 (에러를 던지지 않음)
    return {
      showToast: () => {},
      showSuccess: () => {},
      showError: (message: string) => {
        console.error("Toast Error:", message);
      },
      showInfo: () => {},
      showWarning: () => {},
    };
  }
  return context;
}

