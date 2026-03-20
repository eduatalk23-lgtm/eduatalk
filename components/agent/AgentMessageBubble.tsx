"use client";

// ============================================
// AgentMessageBubble — AI SDK v6 UIMessage 렌더링
// ============================================

import type { UIMessage } from "ai";
import { cn } from "@/lib/cn";
import {
  Bot,
  User,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface AgentMessageBubbleProps {
  message: UIMessage;
}

/** 도구 이름 → 한국어 라벨 */
const TOOL_LABELS: Record<string, string> = {
  getStudentRecords: "생기부 기록 조회",
  getStudentDiagnosis: "진단 데이터 조회",
  getStudentStorylines: "스토리라인 조회",
  suggestTags: "역량 태그 분석",
  analyzeCompetency: "역량 등급 분석",
  analyzeHighlight: "하이라이트 분석",
  detectStoryline: "탐구 연결 감지",
  generateDiagnosis: "종합 진단 생성",
  suggestStrategies: "보완전략 제안",
  getWarnings: "경보 조회",
  searchGuides: "가이드 검색",
  getGuideDetail: "가이드 상세 조회",
  getStudentAssignments: "배정 목록 조회",
};

export function AgentMessageBubble({ message }: AgentMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-2.5",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* 아바타 */}
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
          isUser
            ? "bg-[rgb(var(--color-primary-100))]"
            : "bg-[rgb(var(--color-secondary-200))]",
        )}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-[rgb(var(--color-primary-700))]" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
        )}
      </div>

      {/* 메시지 내용 */}
      <div className={cn("flex-1 min-w-0 flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        {message.parts.map((part, i) => {
          // 텍스트 파트
          if (part.type === "text" && part.text) {
            return (
              <div
                key={`text-${i}`}
                className={cn(
                  "inline-block rounded-xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] text-left",
                  isUser
                    ? "bg-[rgb(var(--color-primary-600))] text-white rounded-tr-sm"
                    : "bg-[rgb(var(--color-secondary-100))] text-[var(--color-text-primary)] rounded-tl-sm",
                )}
              >
                <FormattedText text={part.text} />
              </div>
            );
          }

          // 도구 호출 파트 (tool-* 또는 dynamic-tool)
          if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            const toolPart = part as { type: string; state?: string; toolName?: string };
            const toolName = toolPart.type === "dynamic-tool"
              ? (toolPart.toolName ?? "unknown")
              : toolPart.type.replace("tool-", "");
            const isComplete = toolPart.state === "output-available";
            const isRunning = toolPart.state === "input-streaming" || toolPart.state === "input-available";
            const label = TOOL_LABELS[toolName] ?? toolName;

            return (
              <div key={`tool-${i}`} className="flex items-center gap-1.5 pb-0.5">
                <div
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium",
                    isComplete
                      ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                      : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400",
                  )}
                >
                  {isRunning ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  {label}
                  {isRunning && "..."}
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

/** 마크다운 기본 포맷팅 (bold, 줄바꿈) */
function FormattedText({ text }: { text: string }) {
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");

  return (
    <span
      dangerouslySetInnerHTML={{ __html: formatted }}
      className="[&>strong]:font-semibold"
    />
  );
}
