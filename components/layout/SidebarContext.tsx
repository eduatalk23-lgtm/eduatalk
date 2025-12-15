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
 * 기본 collapsed 상태 결정
 * - 웹 환경(768px 이상): 항상 펼침 (false) - 접기 기능 제거
 * - 모바일 환경: 접힘 기본 (true)
 */
function getDefaultCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  
  // 웹 환경에서는 항상 펼침 상태 유지
  if (!isMobileDevice()) {
    return false;
  }
  
  // 모바일 환경에서만 localStorage 확인
  const stored = localStorage.getItem(STORAGE_KEYS.COLLAPSED);
  if (stored !== null) {
    return stored === "true";
  }
  
  // 모바일 기본값
  return true;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(getDefaultCollapsed);

  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  // 화면 크기 변경 시 모바일/데스크톱 전환 처리
  useEffect(() => {
    const handleResize = () => {
      // 웹 환경으로 전환되면 항상 펼침 상태로
      if (!isMobileDevice()) {
        setIsCollapsed(false);
        return;
      }
      
      // 모바일 환경에서만 localStorage 확인
      const stored = localStorage.getItem(STORAGE_KEYS.COLLAPSED);
      if (stored === null) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 웹 환경에서는 collapsed 상태 변경 무시하고 항상 false 유지
  useEffect(() => {
    if (!isMobileDevice()) {
      setIsCollapsed(false);
      return;
    }
    // 모바일 환경에서만 localStorage 저장
    localStorage.setItem(STORAGE_KEYS.COLLAPSED, String(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapse = () => {
    // 웹 환경에서는 접기 기능 비활성화
    if (!isMobileDevice()) {
      return;
    }
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

