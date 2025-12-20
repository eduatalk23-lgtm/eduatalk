"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo } from "react";
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // 클라이언트에서만 마운트되도록 보장
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "success", duration = 3000) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type, duration }]);
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

