"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type SidebarContextType = {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isMobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEYS = {
  COLLAPSED: "sidebar-collapsed",
} as const;

/**
 * 모바일 환경 감지 (768px 미만)
 */
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

/**
 * SSR/CSR 기본값: 항상 false (펼침)
 * Hydration 불일치 방지를 위해 초기값은 항상 동일해야 함
 */
const DEFAULT_COLLAPSED = false;

export function SidebarProvider({ children }: { children: ReactNode }) {
  // 초기값은 서버/클라이언트 동일하게 false로 설정 (Hydration 일치)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(DEFAULT_COLLAPSED);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  // Hydration 완료 후 localStorage 값 적용
  useEffect(() => {
    // localStorage에서 저장된 값 확인
    const stored = localStorage.getItem(STORAGE_KEYS.COLLAPSED);
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    } else if (isMobileDevice()) {
      // 저장된 값이 없고 모바일이면 접기
      setIsCollapsed(true);
    }
    setIsHydrated(true);
  }, []);

  // 화면 크기 변경 시 모바일/데스크톱 전환 처리
  useEffect(() => {
    const handleResize = () => {
      // 리사이즈 시에는 기존 상태 유지하되, 모바일<->데스크톱 전환 시 로직이 필요하다면 추가
      // 현재는 단순히 반응형으로 레이아웃이 바뀌므로 상태 강제 변경은 최소화
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // collapsed 상태 변경 시 localStorage 저장 (Hydration 완료 후에만)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEYS.COLLAPSED, String(isCollapsed));
    }
  }, [isCollapsed, isHydrated]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  const toggleMobile = () => {
    setIsMobileOpen((prev) => !prev);
  };

  const closeMobile = () => {
    setIsMobileOpen(false);
  };

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleCollapse,
        isMobileOpen,
        toggleMobile,
        closeMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

