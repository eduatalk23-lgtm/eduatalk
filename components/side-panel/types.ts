/** 사이드 패널에 등록된 앱 ID */
export type SidePanelAppId = "memo" | "chat" | "connections" | "graph" | "scores" | "pipeline";

export interface SidePanelAppConfig {
  id: SidePanelAppId;
  label: string;
  icon: string; // lucide icon name
  /** true면 2/3 화면 너비로 표시 (기본: 360px) */
  wide?: boolean;
}

/** 기본 앱 목록 (캘린더 등 공통 도메인) */
export const BASE_SIDE_PANEL_APPS: SidePanelAppConfig[] = [
  { id: "memo", label: "메모", icon: "StickyNote" },
  { id: "chat", label: "채팅", icon: "MessageSquare" },
];

/** 생기부 전용 앱 (연결 + 그래프 + 파이프라인) */
export const RECORD_SIDE_PANEL_APPS: SidePanelAppConfig[] = [
  ...BASE_SIDE_PANEL_APPS,
  { id: "connections", label: "연결", icon: "Network" },
  { id: "graph", label: "그래프", icon: "GitFork", wide: true },
  { id: "pipeline", label: "AI 파이프라인", icon: "Gauge", wide: true },
];

/** @deprecated SIDE_PANEL_APPS 대신 BASE_SIDE_PANEL_APPS 또는 RECORD_SIDE_PANEL_APPS 사용 */
export const SIDE_PANEL_APPS = BASE_SIDE_PANEL_APPS;
