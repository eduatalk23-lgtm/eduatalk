"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { SidePanelAppId } from "./types";

// ============================================================
// localStorage helpers (SSR-safe)
// ============================================================

const LS_KEY_APP = "calendarLayout_sidePanelApp";

function readLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

function writeLS(key: string, value: string) {
  if (typeof window !== "undefined") localStorage.setItem(key, value);
}

// ============================================================
// Breakpoint: 1200px 기준으로 wide desktop 판별
// ============================================================

function getIsWideDesktop(): boolean {
  return window.matchMedia("(min-width: 1200px)").matches;
}

function subscribeWideDesktop(cb: () => void) {
  const mq = window.matchMedia("(min-width: 1200px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getIsMobile(): boolean {
  return window.matchMedia("(max-width: 767px)").matches;
}

function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

// ============================================================
// Context
// ============================================================

interface SidePanelContextValue {
  /** 현재 열린 앱 (null = 패널 닫힘) */
  activeApp: SidePanelAppId | null;
  /** 패널이 열려 있는지 (derived) */
  isPanelOpen: boolean;
  /** 1200px 이상인지 */
  isWideDesktop: boolean;
  /** 768px 미만인지 */
  isMobile: boolean;
  /** 앱 열기 */
  openApp: (app: SidePanelAppId) => void;
  /** 패널 닫기 (레일은 유지) */
  closePanel: () => void;
  /** 같은 아이콘 = 닫기, 다른 아이콘 = 전환 */
  toggleApp: (app: SidePanelAppId) => void;
}

const SidePanelContext = createContext<SidePanelContextValue | null>(null);

export function SidePanelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeApp, setActiveApp] = useState<SidePanelAppId | null>(() => {
    const saved = readLS(LS_KEY_APP, "");
    return saved ? (saved as SidePanelAppId) : null;
  });

  const isWideDesktop = useSyncExternalStore(
    subscribeWideDesktop,
    getIsWideDesktop,
    () => true // SSR: assume wide
  );

  const isMobile = useSyncExternalStore(
    subscribeMobile,
    getIsMobile,
    () => false // SSR: assume not mobile
  );

  const openApp = useCallback((app: SidePanelAppId) => {
    setActiveApp(app);
    writeLS(LS_KEY_APP, app);
  }, []);

  const closePanel = useCallback(() => {
    setActiveApp(null);
    writeLS(LS_KEY_APP, "");
  }, []);

  const toggleApp = useCallback(
    (app: SidePanelAppId) => {
      if (activeApp === app) {
        closePanel();
      } else {
        openApp(app);
      }
    },
    [activeApp, closePanel, openApp]
  );

  const value = useMemo<SidePanelContextValue>(
    () => ({
      activeApp,
      isPanelOpen: activeApp !== null,
      isWideDesktop,
      isMobile,
      openApp,
      closePanel,
      toggleApp,
    }),
    [activeApp, isWideDesktop, isMobile, openApp, closePanel, toggleApp]
  );

  return (
    <SidePanelContext.Provider value={value}>
      {children}
    </SidePanelContext.Provider>
  );
}

export function useSidePanel(): SidePanelContextValue {
  const ctx = useContext(SidePanelContext);
  if (!ctx)
    throw new Error("useSidePanel must be used within SidePanelProvider");
  return ctx;
}
