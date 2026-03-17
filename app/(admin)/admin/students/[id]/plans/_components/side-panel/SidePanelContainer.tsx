"use client";

import dynamic from "next/dynamic";
import { useSidePanel } from "./SidePanelContext";
import { SidePanelContent } from "./SidePanelContent";
import { SidePanelIconRail } from "./SidePanelIconRail";

// 동적 임포트 (코드 스플릿)
const MemoPanelApp = dynamic(
  () => import("./apps/memo/MemoPanelApp").then((m) => m.MemoPanelApp),
  { ssr: false }
);

const ChatPanelApp = dynamic(
  () => import("./apps/chat/ChatPanelApp").then((m) => m.ChatPanelApp),
  { ssr: false }
);

/**
 * 사이드 패널 오케스트레이터
 * CalendarLayoutShell의 rightPanel prop으로 전달됨
 */
export function SidePanelContainer() {
  const { activeApp } = useSidePanel();

  return (
    <>
      <SidePanelContent>
        {activeApp === "memo" && <MemoPanelApp />}
        {activeApp === "chat" && <ChatPanelApp />}
        {/* 향후 확장:
        {activeApp === "scores" && <ScoresPanelApp />}
        */}
      </SidePanelContent>
      <SidePanelIconRail />
    </>
  );
}
