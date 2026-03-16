/**
 * useChatMode - Live/Archive 듀얼 모드 상태머신
 *
 * Live 모드: 일반 채팅. alignToBottom=true, 새 메시지 시 자동 스크롤.
 * Archive 모드: 안 읽은 메시지/검색/답장 진입. alignToBottom=false, 앵커 고정.
 *
 * 전환 규칙:
 * - live → archive: unread divider / 검색 결과 / 답장 클릭
 * - archive → live: 사용자가 최하단 도달 시 자동 전환
 */

import { useCallback, useRef, useState } from "react";

// ============================================
// 타입
// ============================================

export type ChatMode = "live" | "archive";

export interface ChatModeAnchor {
  messageId: string;
  timestamp: string;
}

export interface ChatModeState {
  mode: ChatMode;
  /** Archive 모드 진입 시 앵커 (Live 모드에서는 null) */
  anchor: ChatModeAnchor | null;
  /** Virtuoso alignToBottom prop */
  alignToBottom: boolean;
}

export interface UseChatModeReturn {
  state: ChatModeState;
  /** Archive 모드로 진입 (unread divider, 검색 결과, 답장 등) */
  enterArchive: (anchor: ChatModeAnchor) => void;
  /** Live 모드로 진입 (수동 전환) */
  enterLive: () => void;
  /** Virtuoso atBottomStateChange 핸들러 — archive에서 최하단 도달 시 live로 전환 */
  handleAtBottomChange: (atBottom: boolean) => void;
}

// ============================================
// 훅 구현
// ============================================

export function useChatMode(
  initialAnchor?: ChatModeAnchor | null
): UseChatModeReturn {
  const [state, setState] = useState<ChatModeState>(() => {
    if (initialAnchor) {
      return {
        mode: "archive",
        anchor: initialAnchor,
        alignToBottom: false,
      };
    }
    return {
      mode: "live",
      anchor: null,
      alignToBottom: true,
    };
  });

  // archive→live 전환 시 atBottom 연속 true 감지 (바운스 방지)
  // Virtuoso가 초기 스크롤 중 일시적으로 atBottom=true를 보고할 수 있으므로
  // 마운트 후 1초 이내의 atBottom=true는 무시
  const mountTimeRef = useRef(Date.now());
  const TRANSITION_GUARD_MS = 1_000;

  const enterArchive = useCallback((anchor: ChatModeAnchor) => {
    setState({
      mode: "archive",
      anchor,
      alignToBottom: false,
    });
  }, []);

  const enterLive = useCallback(() => {
    setState({
      mode: "live",
      anchor: null,
      alignToBottom: true,
    });
  }, []);

  const handleAtBottomChange = useCallback(
    (atBottom: boolean) => {
      if (
        atBottom &&
        state.mode === "archive" &&
        Date.now() - mountTimeRef.current > TRANSITION_GUARD_MS
      ) {
        // archive 모드에서 최하단 도달 → live 모드로 자연스러운 전환
        setState({
          mode: "live",
          anchor: null,
          alignToBottom: true,
        });
      }
    },
    [state.mode]
  );

  return { state, enterArchive, enterLive, handleAtBottomChange };
}
