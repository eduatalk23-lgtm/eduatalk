"use client";

// ============================================
// AgentMessageBubble — AI SDK v6 UIMessage 렌더링
// ============================================

import { useState, useCallback } from "react";
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
  Pencil,
  X,
  Send,
} from "lucide-react";
import DOMPurify from "dompurify";
import { isAgentAction, type AgentAction } from "@/lib/agents/agent-actions";

interface AgentMessageBubbleProps {
  message: UIMessage;
  messageIndex?: number;
  sessionId?: string | null;
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

export function AgentMessageBubble({ message, messageIndex, sessionId, onAgentAction }: AgentMessageBubbleProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState("");
  const [correctionType, setCorrectionType] = useState<string>("strategic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 어시스턴트 메시지의 전체 텍스트 추출
  const assistantText = isAssistant
    ? message.parts
        .filter((p) => p.type === "text" && "text" in p)
        .map((p) => (p as { text: string }).text)
        .join("\n")
    : "";

  const handleSubmitCorrection = useCallback(async () => {
    if (!correctionText.trim() || !sessionId || messageIndex == null) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/agent/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messageIndex,
          originalResponse: assistantText.slice(0, 4000),
          correctionText: correctionText.trim(),
          correctionType,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        setShowCorrection(false);
        setCorrectionText("");
      }
    } catch {
      // silent
    } finally {
      setIsSubmitting(false);
    }
  }, [correctionText, correctionType, sessionId, messageIndex, assistantText]);

  return (
    <div
      className={cn(
        "flex gap-2.5 group",
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

            // think 도구는 내부 추론용 — UI에 표시하지 않음
            if (toolName === "think") return null;

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

        {/* 교정 버튼 (어시스턴트 메시지 + sessionId 있을 때) */}
        {isAssistant && sessionId && !submitted && (
          <div className="flex items-center gap-1 mt-0.5">
            {!showCorrection && (
              <button
                type="button"
                onClick={() => setShowCorrection(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[rgb(var(--color-secondary-100))]"
                title="이 답변 교정하기"
              >
                <Pencil className="w-3 h-3" />
                교정
              </button>
            )}
          </div>
        )}

        {/* 교정 완료 표시 */}
        {submitted && (
          <span className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">
            교정 완료
          </span>
        )}

        {/* 교정 입력 폼 */}
        {showCorrection && (
          <div className="w-full max-w-[85%] mt-1 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">답변 교정</span>
              <button type="button" onClick={() => setShowCorrection(false)} className="p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30">
                <X className="w-3 h-3 text-amber-600" />
              </button>
            </div>
            <select
              value={correctionType}
              onChange={(e) => setCorrectionType(e.target.value)}
              className="w-full mb-1.5 px-2 py-1 rounded border border-amber-200 dark:border-amber-700 bg-white dark:bg-amber-950/30 text-[11px] text-[var(--color-text-primary)]"
            >
              <option value="factual">사실 오류</option>
              <option value="strategic">전략 오류</option>
              <option value="nuance">뉘앙스/맥락 부족</option>
              <option value="missing">누락된 포인트</option>
            </select>
            <textarea
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              placeholder="어떻게 교정해야 하는지 작성하세요..."
              rows={2}
              className="w-full px-2 py-1.5 rounded border border-amber-200 dark:border-amber-700 bg-white dark:bg-amber-950/30 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                disabled={!correctionText.trim() || isSubmitting}
                onClick={handleSubmitCorrection}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                  correctionText.trim() && !isSubmitting
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-amber-200 text-amber-400 cursor-not-allowed",
                )}
              >
                {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                교정 저장
              </button>
            </div>
          </div>
        )}
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
