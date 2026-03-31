"use client";

// ============================================
// AgentChat — useChat() 기반 채팅 UI
// AI SDK v6 UI Message Stream Protocol
// ============================================

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { Send, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { AgentMessageBubble } from "./AgentMessageBubble";
import type { UIStateSnapshot } from "@/lib/agents/ui-state";
import type { AgentAction } from "@/lib/agents/agent-actions";

interface AgentChatProps {
  studentId: string;
  studentName: string;
  className?: string;
  /** UI 상태 스냅샷 함수 (요청 시점에 호출) */
  getUIState?: () => UIStateSnapshot;
  /** 에이전트 네비게이션 액션 콜백 */
  onAgentAction?: (action: AgentAction) => void;
}

export function AgentChat({
  studentId,
  studentName,
  className,
  getUIState,
  onAgentAction,
}: AgentChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [chatSessionId, setChatSessionId] = useState(() => crypto.randomUUID());

  // useRef로 getUIState 참조 → transport useMemo 재생성 방지
  const getUIStateRef = useRef(getUIState);
  useEffect(() => {
    getUIStateRef.current = getUIState;
  }, [getUIState]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: () => ({
          studentId,
          studentName,
          chatSessionId,
          uiState: getUIStateRef.current?.() ?? null,
        }),
      }),
    [studentId, studentName, chatSessionId],
  );

  const {
    messages,
    sendMessage,
    regenerate,
    stop,
    status,
    error,
    setMessages,
  } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  // 새 메시지 시 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 학생 변경 시 진행중 스트림 중단 + 대화 초기화
  useEffect(() => {
    stop();
    setMessages([]);
    setInput("");
    setChatSessionId(crypto.randomUUID());
  }, [studentId, stop, setMessages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage({ text });
  }, [input, isLoading, sendMessage]);

  // Enter로 전송 (Shift+Enter는 줄바꿈)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // UI 상태 기반 동적 추천 질문
  const suggestions = useMemo(() => {
    const DEFAULT = [
      "세특 강약점 분석해줘",
      "보완 전략 추천해줘",
      "탐구 가이드 추천해줘",
    ];

    const uiState = getUIStateRef.current?.();
    if (!uiState) return DEFAULT;

    const contextual: string[] = [];

    if (uiState.focusedSubject) {
      const name = uiState.focusedSubject.subjectName;
      contextual.push(`${name} 세특 분석해줘`);
      contextual.push(`${name} 보완 전략은?`);
      contextual.push(`${name} 탐구 가이드 추천해줘`);
    }

    if (!uiState.focusedSubject && uiState.activeStage === "diagnosis") {
      contextual.push("약점 역량 보완 방법 알려줘");
      contextual.push("교차 분석 결과 요약해줘");
      contextual.push("탐구 가이드 추천해줘");
    }

    if (!uiState.focusedSubject && uiState.activeStage === "design") {
      contextual.push("스토리라인 일관성 점검해줘");
      contextual.push("세특 방향 가이드 생성해줘");
      contextual.push("탐구 가이드 추천해줘");
    }

    if (!uiState.focusedSubject && uiState.activeStage === "strategy") {
      contextual.push("배치 분석 실행해줘");
      contextual.push("면접 예상 질문 만들어줘");
      contextual.push("우회학과 분석해줘");
    }

    return contextual.length > 0 ? contextual : DEFAULT;
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps -- 대화 시작 시 + 초기화 시만 재계산

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 메시지 영역 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
            <div className="w-12 h-12 rounded-full bg-[rgb(var(--color-primary-100))] flex items-center justify-center">
              <span className="text-xl">🤖</span>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                AI 어시스턴트
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] pt-1">
                {studentName} 학생의 생기부를 분석하고
                <br />
                전략을 수립할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="px-3 py-1.5 text-xs rounded-full border border-[rgb(var(--color-secondary-300))] text-[var(--color-text-secondary)] hover:bg-[rgb(var(--color-secondary-100))] transition-colors"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, idx) => (
          <AgentMessageBubble
            key={message.id}
            message={message}
            messageIndex={idx}
            sessionId={chatSessionId}
            onAgentAction={onAgentAction}
          />
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            분석 중...
          </div>
        )}
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/20 border-t border-red-200 dark:border-red-800 flex items-center gap-2">
          <p className="text-xs text-red-600 dark:text-red-400 flex-1">
            {(() => {
              const status = (error as { status?: number }).status;
              if (status === 429) return "요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.";
              if (status === 401 || status === 403) return "인증이 필요합니다. 페이지를 새로고침 해주세요.";
              if (status && status >= 500) return "서버 에러가 발생했습니다. 잠시 후 다시 시도해주세요.";
              return error.message || "에러가 발생했습니다.";
            })()}
          </p>
          <button
            type="button"
            onClick={() => regenerate()}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
            title="재시도"
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="border-t border-[rgb(var(--color-secondary-200))] p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="질문을 입력하세요..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-[rgb(var(--color-secondary-300))] bg-[var(--background)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary-500))] focus:border-transparent max-h-32"
            style={{ minHeight: "36px" }}
            disabled={isLoading}
          />
          <button
            type="button"
            disabled={!input.trim() || isLoading}
            onClick={handleSend}
            className={cn(
              "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-colors",
              input.trim() && !isLoading
                ? "bg-[rgb(var(--color-primary-600))] text-white hover:bg-[rgb(var(--color-primary-700))]"
                : "bg-[rgb(var(--color-secondary-200))] text-[var(--color-text-tertiary)] cursor-not-allowed",
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
