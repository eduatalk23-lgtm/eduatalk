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

interface AgentChatProps {
  studentId: string;
  studentName: string;
  className?: string;
}

export function AgentChat({ studentId, studentName, className }: AgentChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: { studentId, studentName },
      }),
    [studentId, studentName],
  );

  const {
    messages,
    sendMessage,
    regenerate,
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

  // 학생 변경 시 대화 초기화
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [studentId, setMessages]);

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
              {[
                "세특 강약점 분석해줘",
                "보완 전략 추천해줘",
                "탐구 가이드 추천해줘",
              ].map((suggestion) => (
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

        {messages.map((message) => (
          <AgentMessageBubble key={message.id} message={message} />
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
            {error.message || "에러가 발생했습니다."}
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
