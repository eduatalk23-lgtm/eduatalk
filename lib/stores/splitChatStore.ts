"use client";

import { create } from "zustand";
import type { HandoffInput } from "@/lib/domains/ai-chat/handoff/validator";

/**
 * Phase T-3: Split Chat Panel 전역 상태
 *
 * 같은 페이지를 유지하면서 우측 슬라이드 오버레이로 AI 대화를 여는 모드.
 * HandoffLauncher 드롭다운의 "이 화면에서 대화" 클릭 시 openSplit 호출.
 *
 * conversationId 는 패널이 처음 열릴 때 생성해서 유지. 같은 대화를 다시
 * 열거나 전체 화면(/ai-chat?id=)으로 승격하기 위해 필요.
 */

type SplitChatState = {
  open: boolean;
  conversationId: string | null;
  handoffInput: HandoffInput | null;
  openSplit: (params: { conversationId: string; input: HandoffInput }) => void;
  closeSplit: () => void;
  reset: () => void;
};

export const useSplitChatStore = create<SplitChatState>((set) => ({
  open: false,
  conversationId: null,
  handoffInput: null,
  openSplit: ({ conversationId, input }) =>
    set({ open: true, conversationId, handoffInput: input }),
  closeSplit: () => set({ open: false }),
  reset: () =>
    set({ open: false, conversationId: null, handoffInput: null }),
}));
