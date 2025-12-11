"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type SidebarContextType = {
  isCollapsed: boolean;
  isPinned: boolean;
  toggleCollapse: () => void;
  togglePin: () => void;
  isMobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const STORAGE_KEYS = {
  COLLAPSED: "sidebar-collapsed",
  PINNED: "sidebar-pinned",
} as const;

/**
 * 모바일 환경 감지 (768px 미만)
 */
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

/**
 * 기본 collapsed 상태 결정
 * - 웹 환경(큰 화면): 펼침 기본 (false)
 * - 모바일 환경: 접힘 기본 (true)
 */
function getDefaultCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  
  // localStorage에 저장된 값이 있으면 사용
  const stored = localStorage.getItem(STORAGE_KEYS.COLLAPSED);
  if (stored !== null) {
    return stored === "true";
  }
  
  // 저장된 값이 없으면 디바이스 타입에 따라 기본값 설정
  return isMobileDevice();
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(getDefaultCollapsed);

  const [isPinned, setIsPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEYS.PINNED);
    return stored !== "false"; // 기본값은 true
  });

  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  // 화면 크기 변경 시 모바일/데스크톱 전환 처리
  useEffect(() => {
    const handleResize = () => {
      // 모바일로 전환되면 접힘 상태로, 데스크톱으로 전환되면 펼침 상태로
      // 단, 사용자가 수동으로 변경한 경우는 유지
      const stored = localStorage.getItem(STORAGE_KEYS.COLLAPSED);
      if (stored === null) {
        // 저장된 값이 없을 때만 자동으로 조정
        setIsCollapsed(isMobileDevice());
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COLLAPSED, String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PINNED, String(isPinned));
  }, [isPinned]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  const togglePin = () => {
    setIsPinned((prev) => !prev);
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
        isPinned,
        toggleCollapse,
        togglePin,
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

