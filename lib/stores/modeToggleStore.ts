"use client";

import { create } from "zustand";

/**
 * Phase T 글로벌 모드 토글 상태
 *
 * GUI 환경(/dashboard·/plan·/scores 등) ↔ AI 내러티브 환경(/ai-chat) 전환 시
 * 직전 컨텍스트를 유지해 "정확한 복귀"를 가능하게 함.
 *
 * - lastGuiPath: 사용자가 GUI → /ai-chat 으로 진입하기 직전 경로. /ai-chat
 *   에서 "GUI 로 복귀" 클릭 시 이 경로로 이동 (없으면 "/" 로 proxy 리다이렉트).
 * - lastChatId: 사용자가 /ai-chat → GUI 로 나갈 때 진행 중이던 대화 ID.
 *   GUI 에서 "대화방으로" 클릭 시 이 ID 대화로 바로 복귀 (없으면 새 대화).
 *
 * sessionStorage 사용 — 탭 단위 격리, 브라우저 새로고침 시 유지.
 */

const STORAGE_KEY_GUI = "mode-toggle:last-gui-path";
const STORAGE_KEY_CHAT = "mode-toggle:last-chat-id";

type ModeToggleState = {
  lastGuiPath: string | null;
  lastChatId: string | null;
  setLastGuiPath: (path: string | null) => void;
  setLastChatId: (id: string | null) => void;
  hydrate: () => void;
};

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
    }
  } catch {
    // 저장 실패 시 무시 (프라이빗 모드 등)
  }
}

export const useModeToggleStore = create<ModeToggleState>((set) => ({
  lastGuiPath: null,
  lastChatId: null,
  setLastGuiPath: (path) => {
    writeStorage(STORAGE_KEY_GUI, path);
    set({ lastGuiPath: path });
  },
  setLastChatId: (id) => {
    writeStorage(STORAGE_KEY_CHAT, id);
    set({ lastChatId: id });
  },
  hydrate: () => {
    set({
      lastGuiPath: readStorage(STORAGE_KEY_GUI),
      lastChatId: readStorage(STORAGE_KEY_CHAT),
    });
  },
}));
