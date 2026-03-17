/** 사이드 패널에 등록된 앱 ID */
export type SidePanelAppId = "memo" | "chat" | "scores";

export interface SidePanelAppConfig {
  id: SidePanelAppId;
  label: string;
  icon: string; // lucide icon name
}

/** 등록된 앱 목록 (아이콘 레일 순서) */
export const SIDE_PANEL_APPS: SidePanelAppConfig[] = [
  { id: "memo", label: "메모", icon: "StickyNote" },
  { id: "chat", label: "채팅", icon: "MessageSquare" },
  // 향후 확장:
  // { id: "scores", label: "성적", icon: "BarChart2" },
];
