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

const LS_KEY_APP = "sidePanelApp";

function readLS(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
}

function writeLS(key: string, value: string) {
  if (typeof window !== "undefined") localStorage.setItem(key, value);
}

// ============================================================
// Breakpoint: 1200px wide desktop, 768px mobile
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
  activeApp: SidePanelAppId | null;
  isPanelOpen: boolean;
  isWideDesktop: boolean;
  isMobile: boolean;
  openApp: (app: SidePanelAppId) => void;
  closePanel: () => void;
  toggleApp: (app: SidePanelAppId) => void;
}

const SidePanelContext = createContext<SidePanelContextValue | null>(null);

export function SidePanelProvider({
  children,
  storageKey,
}: {
  children: React.ReactNode;
  /** localStorage 키 접두사 (페이지별 분리, 기본: "sidePanelApp") */
  storageKey?: string;
}) {
  const lsKey = storageKey ?? LS_KEY_APP;

  const [activeApp, setActiveApp] = useState<SidePanelAppId | null>(() => {
    const saved = readLS(lsKey, "");
    return saved ? (saved as SidePanelAppId) : null;
  });

  const isWideDesktop = useSyncExternalStore(
    subscribeWideDesktop,
    getIsWideDesktop,
    () => true
  );

  const isMobile = useSyncExternalStore(
    subscribeMobile,
    getIsMobile,
    () => false
  );

  const openApp = useCallback((app: SidePanelAppId) => {
    setActiveApp(app);
    writeLS(lsKey, app);
  }, [lsKey]);

  const closePanel = useCallback(() => {
    setActiveApp(null);
    writeLS(lsKey, "");
  }, [lsKey]);

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
