"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type SidebarContextType = {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isMobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

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

const defaultSidebarContext: SidebarContextType = {
  isCollapsed: true,
  toggleCollapse: () => {},
  isMobileOpen: false,
  toggleMobile: () => {},
  closeMobile: () => {},
};

export function useSidebar() {
  const context = useContext(SidebarContext);
  return context ?? defaultSidebarContext;
}
