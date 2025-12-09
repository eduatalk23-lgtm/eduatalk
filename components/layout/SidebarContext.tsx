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

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(STORAGE_KEYS.COLLAPSED);
    return stored === "true";
  });

  const [isPinned, setIsPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEYS.PINNED);
    return stored !== "false"; // 기본값은 true
  });

  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

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

