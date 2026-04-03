/** 사이드 패널에 등록된 앱 ID */
export type SidePanelAppId = "memo" | "chat" | "connections" | "scores" | "pipeline";

export interface SidePanelAppConfig {
  id: SidePanelAppId;
  label: string;
  icon: string; // lucide icon name
  /** true면 2/3 화면 너비로 표시 (기본: 360px) */
  wide?: boolean;
}

/** 등록된 앱 목록 (아이콘 레일 순서) */
export const SIDE_PANEL_APPS: SidePanelAppConfig[] = [
  { id: "memo", label: "메모", icon: "StickyNote" },
  { id: "chat", label: "채팅", icon: "MessageSquare" },
  { id: "connections", label: "연결", icon: "Network" },
  { id: "pipeline", label: "AI 파이프라인", icon: "Gauge", wide: true },
];
