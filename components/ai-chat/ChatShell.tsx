"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useTheme } from "next-themes";
import {
  ArrowUp,
  Square,
  Plus,
  BarChart3,
  Navigation,
  ExternalLink,
  Moon,
  Sun,
  PanelLeft,
  Sparkles,
  Maximize2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ScoresCard } from "@/components/ai-chat/ScoresCard";
import { ArtifactPanel } from "@/components/ai-chat/ArtifactPanel";
import { Markdown } from "@/components/ai-chat/Markdown";
import { ReasoningBlock } from "@/components/ai-chat/ReasoningBlock";
import { ToolCard, type ToolCardState } from "@/components/ai-chat/ToolCard";
import {
  ConversationSidebar,
  type ConversationListItem,
} from "@/components/ai-chat/ConversationSidebar";
import { useArtifactStore } from "@/lib/stores/artifactStore";
import type { GetScoresOutput } from "@/app/api/chat/route";

type NavigateToOutput =
  | { ok: true; path: string; reason: string }
  | { ok: false; path: string; reason: string };

const PATH_LABELS: Record<string, string> = {
  // student
  "/dashboard": "대시보드",
  "/plan": "학습 플랜",
  "/scores": "성적",
  "/analysis": "생기부 분석",
  "/guides": "탐구 가이드",
  "/settings": "설정",
  // admin/consultant
  "/admin/dashboard": "관리자 대시보드",
  "/admin/students": "학생 목록",
  "/admin/guides": "가이드 관리",
  "/admin/settings": "관리자 설정",
  // parent
  "/parent/dashboard": "학부모 대시보드",
  "/parent/record": "자녀 생기부",
  "/parent/scores": "자녀 성적",
  "/parent/settings": "학부모 설정",
};

const DEFAULT_SUGGESTION_CHIPS: Array<{ category: string; text: string }> = [
  { category: "성적", text: "내 성적 보여줘" },
  { category: "학습", text: "이번 주 학습 플랜 확인하고 싶어" },
  { category: "탐구", text: "탐구 가이드 추천해줘" },
  { category: "이동", text: "생기부 분석 화면 열어줘" },
];

export type ChatBannerOrigin = {
  source: string;
  label: string;
  originPath: string;
};

export type ChatShellVariant = "full" | "split";

type Props = {
  conversationId: string;
  initialMessages: UIMessage[];
  conversations: ConversationListItem[];
  bannerOrigin?: ChatBannerOrigin | null;
  suggestionChips?: Array<{ category: string; text: string }>;
  /**
   * Phase T-3: 레이아웃 variant.
   * - "full" (기본): 사이드바 + 헤더 + Artifact 패널 전부. /ai-chat 페이지 전용.
   * - "split": 우측 오버레이. 사이드바/Artifact 제거, 헤더 간소화, 닫기 버튼 제공.
   */
  variant?: ChatShellVariant;
  /** split variant에서 패널 닫기 콜백 */
  onClose?: () => void;
  /** split variant에서 전체 화면으로 승격 */
  onExpand?: () => void;
};

export function ChatShell({
  conversationId,
  initialMessages,
  conversations,
  bannerOrigin,
  suggestionChips,
  variant = "full",
  onClose,
  onExpand,
}: Props) {
  const isSplit = variant === "split";
  const router = useRouter();
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openArtifact = useArtifactStore((s) => s.openArtifact);
  const openedArtifactId = useArtifactStore((s) => s.artifact?.id ?? null);

  const { messages, sendMessage, status, error, stop } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    // Vercel AI Chatbot 공식 패턴 적용: 응답 완료 시 서버 컴포넌트 재실행 →
    // listConversations 재조회 → 사이드바 자동 갱신(제목·최근활동·신규 대화 반영).
    // router.refresh 는 서버 컴포넌트만 재실행하고 useChat messages 등 클라이언트
    // state 는 보존함.
    onFinish: () => {
      router.refresh();
    },
  });

  const isBusy = status === "submitted" || status === "streaming";

  // textarea auto-grow
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [input]);

  // 메시지 추가 시 자동 하단 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const submit = () => {
    const text = input.trim();
    if (!text || isBusy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div
      className={cn(
        "flex bg-white dark:bg-zinc-950",
        isSplit ? "h-full" : "h-dvh",
      )}
      aria-label="에듀엣톡 AI 대화"
    >
      {!isSplit && (
        <ConversationSidebar
          conversations={conversations}
          activeId={conversationId}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
      )}
      <div className="flex flex-1 flex-col min-w-0">
        <header
          className={cn(
            "flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800",
            isSplit ? "px-3 py-2" : "px-4 py-3 md:px-6",
          )}
        >
          <div className="flex items-center gap-2">
            {!isSplit && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="대화 목록 열기"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 md:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <PanelLeft size={16} />
              </button>
            )}
            <div className="flex flex-col gap-0.5">
              <h1
                className={cn(
                  "font-semibold text-zinc-900 dark:text-zinc-100",
                  isSplit ? "text-sm" : "text-base",
                )}
              >
                {isSplit ? "이 화면에서 대화" : "에듀엣톡 AI"}
              </h1>
              {!isSplit && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800 dark:text-zinc-300">
                    {conversationId.slice(0, 8)}
                  </code>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSplit ? (
              <>
                {onExpand && (
                  <button
                    type="button"
                    onClick={onExpand}
                    aria-label="전체 화면으로 이동"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <Maximize2 size={14} />
                  </button>
                )}
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="패널 닫기"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <X size={14} />
                  </button>
                )}
              </>
            ) : (
              <>
                <ThemeToggleButton />
                <button
                  type="button"
                  onClick={() => router.push("/ai-chat")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Plus size={14} />새 대화
                </button>
              </>
            )}
          </div>
        </header>

        {bannerOrigin && (
          <HandoffBanner
            label={bannerOrigin.label}
            originPath={bannerOrigin.originPath}
          />
        )}

        <main
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="대화 로그"
          className="flex flex-1 flex-col overflow-y-auto"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
            {messages.length === 0 && !bannerOrigin && (
              <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
                <div className="flex flex-col gap-1">
                  <p className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
                    무엇을 도와드릴까요?
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    성적·학습·진로 관련 질문을 자연스럽게 해보세요.
                  </p>
                </div>
                <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {DEFAULT_SUGGESTION_CHIPS.map((chip) => (
                    <button
                      key={chip.text}
                      type="button"
                      onClick={() => {
                        sendMessage({ text: chip.text });
                      }}
                      className="flex flex-col gap-0.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        {chip.category}
                      </span>
                      <span className="font-medium">{chip.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                openedArtifactId={openedArtifactId}
                onOpenArtifact={openArtifact}
                onNavigate={(path) => {
                  const separator = path.includes("?") ? "&" : "?";
                  router.push(
                    `${path}${separator}fromChat=${encodeURIComponent(conversationId)}`,
                  );
                }}
              />
            ))}

            {bannerOrigin &&
              suggestionChips &&
              suggestionChips.length > 0 &&
              !messages.some((m) => m.role === "user") && (
                <div
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                  role="group"
                  aria-label="맥락 기반 추천 질문"
                >
                  {suggestionChips.map((chip) => (
                    <button
                      key={chip.text}
                      type="button"
                      onClick={() => sendMessage({ text: chip.text })}
                      className="flex flex-col gap-0.5 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        {chip.category}
                      </span>
                      <span className="font-medium">{chip.text}</span>
                    </button>
                  ))}
                </div>
              )}

            <div
              role="status"
              aria-live="polite"
              className={cn(
                "flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500",
                !isBusy && "sr-only",
              )}
            >
              {isBusy && (
                <>
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 [animation-delay:300ms]" />
                  </span>
                  생각 중
                </>
              )}
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                에러: {error.message}
              </p>
            )}
          </div>
        </main>

        <form
          className="border-t border-zinc-200 bg-white px-4 py-3 md:px-6 md:py-4 dark:border-zinc-800 dark:bg-zinc-950"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          aria-label="메시지 입력"
        >
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-zinc-500 dark:focus-within:ring-zinc-600">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="에듀엣톡에게 말해보세요. Shift+Enter로 줄바꿈"
              rows={1}
              aria-label="메시지"
              className="flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            {isBusy ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                aria-label="생성 중지"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
                aria-label="보내기"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-zinc-400 dark:text-zinc-500">
            로컬 Gemma 4 · 응답은 참고용이며 중요한 결정 전 확인하세요.
          </p>
        </form>
      </div>

      {!isSplit && <ArtifactPanel />}
    </div>
  );
}

function HandoffBanner({
  label,
  originPath,
}: {
  label: string;
  originPath: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 md:px-6 dark:border-zinc-800 dark:bg-zinc-900"
      role="note"
      aria-label="대화 맥락 배너"
    >
      <div className="flex items-center gap-2 text-[12px] text-zinc-600 dark:text-zinc-300">
        <Sparkles size={13} className="text-zinc-500 dark:text-zinc-400" />
        <span>
          <span className="font-medium">{label}</span>에서 시작된 대화
        </span>
      </div>
      <Link
        href={originPath}
        className="text-[11px] font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
      >
        원본 보기 ▸
      </Link>
    </div>
  );
}

function ThemeToggleButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="h-8 w-8" aria-hidden />;
  }
  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function toolState(
  raw: string,
): ToolCardState {
  switch (raw) {
    case "input-streaming":
    case "input-available":
      return "running";
    case "output-available":
      return "success";
    case "output-error":
      return "error";
    default:
      return "pending";
  }
}

type MessageRowProps = {
  message: UIMessage;
  openedArtifactId: string | null;
  onOpenArtifact: (artifact: {
    id: string;
    type: "scores";
    title: string;
    subtitle?: string;
    props: unknown;
    originPath?: string;
  }) => void;
  onNavigate: (path: string) => void;
};

function MessageRow({
  message,
  openedArtifactId,
  onOpenArtifact,
  onNavigate,
}: MessageRowProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex flex-col gap-2",
          isUser ? "max-w-[85%]" : "w-full max-w-none",
        )}
      >
        {message.parts.map((p, i) => {
          if (p.type === "text") {
            return (
              <div
                key={i}
                className={cn(
                  "break-words",
                  isUser
                    ? "rounded-2xl bg-zinc-100 px-4 py-2.5 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-900 dark:text-zinc-100",
                )}
              >
                <Markdown
                  text={p.text}
                  variant={isUser ? "user" : "assistant"}
                />
              </div>
            );
          }
          if (p.type === "reasoning") {
            const rState =
              "state" in p && (p.state === "streaming" || p.state === "done")
                ? p.state
                : undefined;
            const rText = "text" in p ? String(p.text ?? "") : "";
            return <ReasoningBlock key={i} text={rText} state={rState} />;
          }
          if (p.type === "tool-getScores" && "state" in p) {
            const state = toolState(p.state);
            const output =
              state === "success" ? (p.output as GetScoresOutput) : undefined;
            const artifactId = `scores:${p.toolCallId}`;
            const input = "input" in p ? (p.input as Record<string, unknown>) : undefined;
            const filterLabel = input
              ? [
                  input.studentName ? String(input.studentName) : null,
                  input.grade ? `${input.grade}학년` : null,
                  input.semester ? `${input.semester}학기` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              : undefined;

            const summary =
              output && output.ok
                ? `${output.studentName ?? "학생"} · ${output.count}과목`
                : output && !output.ok
                  ? output.reason
                  : filterLabel ?? "조회 중";

            const isPanelOpen = openedArtifactId === artifactId;

            return (
              <ToolCard
                key={i}
                name="getScores"
                icon={<BarChart3 size={14} />}
                state={state}
                summary={summary}
                errorText={
                  output && !output.ok ? output.reason : undefined
                }
                footer={
                  output && output.ok && output.count > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenArtifact({
                          id: artifactId,
                          type: "scores",
                          title: `${output.studentName ?? "학생"} 내신 성적`,
                          subtitle: [
                            output.filter.grade
                              ? `${output.filter.grade}학년`
                              : null,
                            output.filter.semester
                              ? `${output.filter.semester}학기`
                              : null,
                            `${output.count}과목`,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          props: output,
                          // Phase T-2b: 학년/학기 필터가 모두 있으면 상세 뷰, 아니면 대시보드로
                          originPath:
                            output.filter.grade && output.filter.semester
                              ? `/scores/school/${output.filter.grade}/${output.filter.semester}`
                              : "/scores",
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      <ExternalLink size={12} />
                      {isPanelOpen ? "패널에 열림" : "패널에서 크게 보기"}
                    </button>
                  ) : null
                }
              >
                {output && output.ok ? <ScoresCard output={output} /> : null}
              </ToolCard>
            );
          }

          if (p.type === "tool-navigateTo" && "state" in p) {
            const rawState = toolState(p.state);
            const output =
              rawState === "success" ? (p.output as NavigateToOutput) : undefined;
            const isDenied = output?.ok === false;
            // role 거부는 success 상태지만 UX 상 error 로 표시
            const state = isDenied ? "error" : rawState;
            const isReady = rawState === "success" && output?.ok === true;
            const label = output?.path
              ? PATH_LABELS[output.path] ?? output.path
              : undefined;

            return (
              <ToolCard
                key={i}
                name="navigateTo"
                icon={<Navigation size={14} />}
                state={state}
                summary={
                  isDenied
                    ? "이 경로로는 이동할 수 없어요"
                    : output?.path ?? label ?? "페이지 준비 중"
                }
                errorText={isDenied ? output.reason : undefined}
                footer={
                  isReady && output?.path ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(output.path)}
                      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
                    >
                      {label ? `${label} 열기` : "열기"}
                      <code className="rounded bg-white/15 px-1.5 py-0.5 text-[10px]">
                        {output.path}
                      </code>
                    </button>
                  ) : null
                }
              >
                {output?.ok === true && output.reason ? (
                  <p className="text-sm text-zinc-700">{output.reason}</p>
                ) : null}
              </ToolCard>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
