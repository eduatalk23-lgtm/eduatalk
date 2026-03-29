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
  MapPin,
  Columns3,
  ArrowRight,
} from "lucide-react";
import DOMPurify from "dompurify";
import { isAgentAction, type AgentAction } from "@/lib/agents/agent-actions";

interface AgentMessageBubbleProps {
  message: UIMessage;
  onAgentAction?: (action: AgentAction) => void;
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
  navigateToSection: "섹션 이동",
  focusSubject: "과목 포커스",
  switchLayerTab: "탭 전환",
};

/** 네비게이션 액션 타입별 라벨 */
const ACTION_LABELS: Record<string, { icon: typeof MapPin; verb: string }> = {
  navigate_section: { icon: MapPin, verb: "섹션으로 이동" },
  navigate_tab: { icon: Columns3, verb: "탭 전환" },
  focus_subject: { icon: ArrowRight, verb: "과목 상세 보기" },
};

export function AgentMessageBubble({ message, onAgentAction }: AgentMessageBubbleProps) {
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
            const toolPart = part as {
              type: string;
              state?: string;
              toolName?: string;
              result?: Record<string, unknown>;
              output?: Record<string, unknown>;
            };
            const toolName = toolPart.type === "dynamic-tool"
              ? (toolPart.toolName ?? "unknown")
              : toolPart.type.replace("tool-", "");
            const isComplete = toolPart.state === "output-available";
            const isRunning = toolPart.state === "input-streaming" || toolPart.state === "input-available";
            const label = TOOL_LABELS[toolName] ?? toolName;

            // 완료된 네비게이션 도구 → 액션 칩 렌더링
            const toolResult = toolPart.result ?? toolPart.output;
            const action = toolResult && isAgentAction(toolResult.action) ? toolResult.action : null;

            if (isComplete && action && onAgentAction) {
              const reason = typeof toolResult?.reason === "string" ? toolResult.reason : "";
              const actionConfig = ACTION_LABELS[action.type];
              const Icon = actionConfig?.icon ?? MapPin;
              const verb = actionConfig?.verb ?? "이동";

              return (
                <button
                  key={`action-${i}`}
                  type="button"
                  onClick={() => onAgentAction(action)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgb(var(--color-primary-50))] dark:bg-[rgb(var(--color-primary-950))] text-[rgb(var(--color-primary-700))] dark:text-[rgb(var(--color-primary-300))] border border-[rgb(var(--color-primary-200))] dark:border-[rgb(var(--color-primary-800))] hover:bg-[rgb(var(--color-primary-100))] dark:hover:bg-[rgb(var(--color-primary-900))] transition-colors cursor-pointer"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {reason || verb}
                </button>
              );
            }

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

  const sanitized = typeof window !== "undefined"
    ? DOMPurify.sanitize(formatted, { ALLOWED_TAGS: ["strong", "br"], ALLOWED_ATTR: [] })
    : formatted;

  return (
    <span
      dangerouslySetInnerHTML={{ __html: sanitized }}
      className="[&>strong]:font-semibold"
    />
  );
}
