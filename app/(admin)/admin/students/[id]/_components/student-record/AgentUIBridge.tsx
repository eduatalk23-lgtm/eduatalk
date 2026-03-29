"use client";

// ============================================
// AgentUIBridge — 에이전트 ↔ UI 양방향 문맥 브릿지
// getSnapshot: UI 상태 → 에이전트 (P0)
// dispatchAction: 에이전트 → UI 네비게이션 (P1)
// ============================================

import { createContext, useContext } from "react";
import type { UIStateSnapshot } from "@/lib/agents/ui-state";
import type { AgentAction } from "@/lib/agents/agent-actions";

interface AgentUIBridgeValue {
  /** 현재 UI 상태 스냅샷 반환 (에이전트 요청 시점에 호출) */
  getSnapshot: () => UIStateSnapshot;
  /** 에이전트 네비게이션 액션 실행 */
  dispatchAction: (action: AgentAction) => void;
}

const AgentUIBridgeContext = createContext<AgentUIBridgeValue | null>(null);

export function AgentUIBridgeProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AgentUIBridgeValue;
}) {
  return (
    <AgentUIBridgeContext.Provider value={value}>
      {children}
    </AgentUIBridgeContext.Provider>
  );
}

export function useAgentUIBridge(): AgentUIBridgeValue | null {
  return useContext(AgentUIBridgeContext);
}
