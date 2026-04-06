"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSidePanel } from "./SidePanelContext";
import { RECORD_SIDE_PANEL_APPS } from "./types";

const PANEL_WIDTH = 360;
const PANEL_WIDTH_WIDE = "66vw"; // 2/3 화면

export function SidePanelContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeApp, isPanelOpen, isWideDesktop, isMobile, closePanel } =
    useSidePanel();

  const activeConfig = RECORD_SIDE_PANEL_APPS.find((a) => a.id === activeApp);
  const isWide = activeConfig?.wide ?? false;
  const panelWidth = isWide ? PANEL_WIDTH_WIDE : PANEL_WIDTH;

  // 모바일: bottom sheet
  if (isMobile) {
    if (!isPanelOpen || !activeConfig) return null;
    return (
      <>
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={closePanel}
        />
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--background)] rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-[rgb(var(--color-secondary-200))]" />
          </div>
          <PanelHeader title={activeConfig.label} onClose={closePanel} />
          <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
            {children}
          </div>
        </div>
      </>
    );
  }

  // 데스크톱: push 레이아웃 (wide 모드는 overlay로 전환)
  if (isWideDesktop) {
    if (isWide) {
      // wide 모드: overlay로 표시 (2/3 화면은 push하면 메인 콘텐츠가 너무 좁아짐)
      if (!isPanelOpen || !activeConfig) return null;
      return (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closePanel} />
          <div
            className="fixed top-0 right-0 h-full z-50 bg-[var(--background)] shadow-xl flex flex-col"
            style={{ width: panelWidth, maxWidth: "calc(100vw - 80px)" }}
          >
            <PanelHeader title={activeConfig.label} onClose={closePanel} />
            <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
              {children}
            </div>
          </div>
        </>
      );
    }
    return (
      <div
        className={cn(
          "flex-shrink-0 bg-[var(--background)] border-l border-[rgb(var(--color-secondary-200))] overflow-hidden flex flex-col",
          "transition-[width] duration-200 ease-in-out",
          isPanelOpen ? "" : "w-0 border-l-0"
        )}
        style={isPanelOpen ? { width: PANEL_WIDTH } : undefined}
      >
        {isPanelOpen && activeConfig && (
          <>
            <PanelHeader title={activeConfig.label} onClose={closePanel} />
            <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
              {children}
            </div>
          </>
        )}
      </div>
    );
  }

  // 태블릿: overlay
  if (!isPanelOpen || !activeConfig) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={closePanel}
      />
      <div
        className="fixed top-0 right-0 h-full z-50 bg-[var(--background)] shadow-xl flex flex-col"
        style={{ width: isWide ? panelWidth : PANEL_WIDTH, maxWidth: "calc(100vw - 40px)" }}
      >
        <PanelHeader title={activeConfig.label} onClose={closePanel} />
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          {children}
        </div>
      </div>
    </>
  );
}

function PanelHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 h-12 border-b border-[rgb(var(--color-secondary-200))] flex-shrink-0">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
        {title}
      </h3>
      <button
        type="button"
        onClick={onClose}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        aria-label="패널 닫기"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export { PANEL_WIDTH };
