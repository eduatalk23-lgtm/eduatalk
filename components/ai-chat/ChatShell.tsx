"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useTheme } from "next-themes";
import {
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
  Archive,
  FileSearch,
  Activity,
  BookOpen,
  Award,
  GitBranch,
  User as UserIcon,
  Brain,
  CalendarClock,
  Target,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ScoresCard } from "@/components/ai-chat/ScoresCard";
import { useConversationArtifactHydration } from "@/lib/hooks/useConversationArtifactHydration";
import { RecordAnalysisCard } from "@/components/ai-chat/RecordAnalysisCard";
import { ArtifactPanel } from "@/components/ai-chat/ArtifactPanel";
import { Markdown } from "@/components/ai-chat/Markdown";
import { ReasoningBlock } from "@/components/ai-chat/ReasoningBlock";
import { ToolCard, type ToolCardState } from "@/components/ai-chat/ToolCard";
import {
  ConversationSidebar,
  type ConversationListItem,
} from "@/components/ai-chat/ConversationSidebar";
import { CommandPalette } from "@/components/ai-chat/CommandPalette";
import type { SlashCommand } from "@/components/ai-chat/SlashMenu";
import { InlineConfirm } from "@/components/ai-chat/InlineConfirm";
import { ChatComposer } from "@/components/ai-chat/ChatComposer";
import { useArtifactStore } from "@/lib/stores/artifactStore";
import {
  extractCitations,
  type MessageCitation,
} from "@/lib/domains/ai-chat/citation-extractor";
import type { ArtifactType } from "@/lib/domains/ai-chat/artifact-repository";
import { MessageCitations } from "@/components/ai-chat/MessageCitations";
import { toggleArchiveConversation } from "@/lib/domains/ai-chat/actions";
import { applyArtifactEdit } from "@/lib/domains/ai-chat/actions/artifactApply";
import type { AnalyzeRecordOutput } from "@/lib/domains/ai-chat/actions/record-analysis";
import type { NavigateToOutput } from "@/lib/mcp/tools/navigateTo";
import type { GetScoresOutput } from "@/lib/mcp/tools/getScores";
import type { AnalyzeRecordDeepOutput } from "@/lib/mcp/tools/analyzeRecordDeep";
import type { DesignStudentPlanOutput } from "@/lib/mcp/tools/designStudentPlan";
import type { AnalyzeAdmissionOutput } from "@/lib/mcp/tools/analyzeAdmission";
import type { GetBlueprintOutput } from "@/lib/mcp/tools/getBlueprint";
import type {
  ArchiveConversationOutput,
  ApplyArtifactEditOutput,
} from "@/app/api/chat/route";

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

export type ChatShellRole =
  | "student"
  | "parent"
  | "consultant"
  | "admin"
  | "superadmin";

type Props = {
  conversationId: string;
  initialMessages: UIMessage[];
  conversations: ConversationListItem[];
  bannerOrigin?: ChatBannerOrigin | null;
  suggestionChips?: Array<{ category: string; text: string }>;
  /** Phase B-2: Cmd+K 팔레트 role-aware 네비게이션용. 기본 student. */
  role?: ChatShellRole;
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
  role = "student",
  variant = "full",
  onClose,
  onExpand,
}: Props) {
  const isSplit = variant === "split";
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<SlashCommand | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openArtifact = useArtifactStore((s) => s.openArtifact);
  const openedArtifactId = useArtifactStore((s) => s.artifact?.id ?? null);
  const hydrateArtifacts = useConversationArtifactHydration(conversationId);

  const { messages, sendMessage, status, error, stop, addToolResult } =
    useChat({
      id: conversationId,
      messages: initialMessages,
      transport: new DefaultChatTransport({ api: "/api/chat" }),
      // Vercel AI Chatbot 공식 패턴 적용: 응답 완료 시 서버 컴포넌트 재실행 →
      // listConversations 재조회 → 사이드바 자동 갱신(제목·최근활동·신규 대화 반영).
      // router.refresh 는 서버 컴포넌트만 재실행하고 useChat messages 등 클라이언트
      // state 는 보존함.
      onFinish: () => {
        router.refresh();
        // Phase C-2: DB 에 저장된 artifact 의 persistedId 를 현재 열린 카드에 주입.
        void hydrateArtifacts();
      },
    });

  const isBusy = status === "submitted" || status === "streaming";

  // Phase B-4 후속: HITL 도구 승인/거부 핸들러. 승인 시 실제 서버 액션 호출 후
  // addToolResult 로 결과 주입 → AI SDK 가 어시스턴트 응답을 이어서 생성.
  const handleArchiveApproval = async (
    toolCallId: string,
    confirmed: boolean,
  ) => {
    if (!confirmed) {
      addToolResult({
        tool: "archiveConversation",
        toolCallId,
        output: {
          ok: false as const,
          reason: "사용자가 취소했습니다.",
        } satisfies ArchiveConversationOutput,
      });
      return;
    }
    const res = await toggleArchiveConversation(conversationId, true);
    const output: ArchiveConversationOutput = res.ok
      ? { ok: true, conversationId }
      : { ok: false, reason: res.error };
    addToolResult({
      tool: "archiveConversation",
      toolCallId,
      output,
    });
    if (res.ok) router.refresh();
  };

  // Phase C-3 Sprint 2: applyArtifactEdit HITL 승인/거부 핸들러.
  // 승인 시 서버 액션 호출 후 addToolResult 로 결과 주입 →
  // AI SDK 가 어시스턴트 응답을 이어서 생성.
  const handleApplyArtifactEditApproval = async (
    toolCallId: string,
    confirmed: boolean,
    input: { artifactId?: string; versionNo?: number | null },
  ) => {
    if (!confirmed) {
      addToolResult({
        tool: "applyArtifactEdit",
        toolCallId,
        output: {
          ok: false as const,
          reason: "사용자가 취소했습니다.",
        } satisfies ApplyArtifactEditOutput,
      });
      return;
    }
    if (!input.artifactId) {
      addToolResult({
        tool: "applyArtifactEdit",
        toolCallId,
        output: {
          ok: false as const,
          reason: "아티팩트 id 가 누락되었습니다.",
        } satisfies ApplyArtifactEditOutput,
      });
      return;
    }
    const result = await applyArtifactEdit({
      artifactId: input.artifactId,
      versionNo: input.versionNo ?? undefined,
    });
    addToolResult({
      tool: "applyArtifactEdit",
      toolCallId,
      output: result,
    });
    if (result.ok) router.refresh();
  };

  // Phase B-2: ⌘K / Ctrl+K 로 팔레트 열기. split 모드에서는 상위 페이지 단축키와
  // 충돌 가능성 있어 full variant 에서만 활성화.
  useEffect(() => {
    if (isSplit) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSplit]);

  // 메시지 추가 시 자동 하단 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const executeSlashCommand = (cmd: SlashCommand) => {
    if (cmd.action.type === "prompt") {
      sendMessage({ text: cmd.action.text });
    } else if (cmd.action.type === "navigate") {
      router.push(cmd.action.path);
    }
    setPendingAction(null);
  };

  const handleSlashCommand = (cmd: SlashCommand) => {
    // /clear 는 현재 대화가 비어있지 않으면 InlineConfirm 으로 승인 받기.
    if (cmd.name === "clear" && messages.length > 0) {
      setPendingAction(cmd);
      return;
    }
    executeSlashCommand(cmd);
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
                  onClick={() => setPaletteOpen(true)}
                  aria-label="명령 팔레트 열기"
                  title="명령 팔레트 (⌘K)"
                  className="hidden items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 sm:inline-flex dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <kbd className="font-sans">⌘K</kbd>
                </button>
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
                onArchiveApproval={handleArchiveApproval}
                onApplyArtifactEditApproval={handleApplyArtifactEditApproval}
                role={role}
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

            {pendingAction && pendingAction.name === "clear" && (
              <InlineConfirm
                title="새 대화를 시작할까요?"
                description="현재 대화는 기록에 남지만 새 화면으로 이동합니다."
                confirmLabel="새 대화 시작"
                tone="neutral"
                onConfirm={() => executeSlashCommand(pendingAction)}
                onCancel={() => setPendingAction(null)}
              />
            )}
          </div>
        </main>

        <ChatComposer
          role={role}
          conversationId={conversationId}
          isBusy={isBusy}
          onSend={({ text, fileParts }) => {
            if (fileParts && fileParts.length > 0) {
              sendMessage({ text, files: fileParts });
            } else {
              sendMessage({ text });
            }
          }}
          onStop={stop}
          onSlashCommand={handleSlashCommand}
        />
      </div>

      {!isSplit && <ArtifactPanel />}

      {!isSplit && (
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          role={role}
          activeConversationId={conversationId}
          conversations={conversations}
        />
      )}
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

/**
 * Phase F-2 후속: MCP 경유 tool 은 UIMessage parts 에서 `type: "dynamic-tool"` +
 * `toolName` 필드 구조로 들어온다(정적 `tool-{name}` 과 구분). 양쪽을 동일하게
 * 처리하기 위해 이 헬퍼로 판정한다.
 */
function matchesTool(p: unknown, name: string): boolean {
  if (typeof p !== "object" || p === null) return false;
  const part = p as { type?: unknown; toolName?: unknown };
  return (
    part.type === `tool-${name}` ||
    (part.type === "dynamic-tool" && part.toolName === name)
  );
}

/**
 * MCP tool 결과는 `{content, structuredContent, isError}` CallToolResult 로
 * 들어온다. 실제 도메인 output 은 `structuredContent`. 래핑 여부와 관계없이
 * 도메인 객체를 꺼낸다.
 */
function extractToolOutput<T>(raw: unknown): T | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as { structuredContent?: unknown };
  if (
    "structuredContent" in r &&
    r.structuredContent &&
    typeof r.structuredContent === "object"
  ) {
    return r.structuredContent as T;
  }
  return raw as T;
}

function statusLabel(
  status: "no_analysis" | "running" | "partial" | "completed",
): string {
  switch (status) {
    case "completed":
      return "분석 완료";
    case "running":
      return "분석 진행 중";
    case "partial":
      return "부분 완료";
    case "no_analysis":
    default:
      return "분석 전";
  }
}

type MessageRowProps = {
  message: UIMessage;
  openedArtifactId: string | null;
  onOpenArtifact: (artifact: {
    id: string;
    type: ArtifactType;
    title: string;
    subtitle?: string;
    props: unknown;
    originPath?: string;
  }) => void;
  onNavigate: (path: string) => void;
  onArchiveApproval: (toolCallId: string, confirmed: boolean) => Promise<void>;
  /**
   * Phase C-3 Sprint 2: applyArtifactEdit HITL 승인 콜백.
   * input 은 해당 tool call 에 LLM 이 제공한 { artifactId, versionNo } 전달.
   */
  onApplyArtifactEditApproval: (
    toolCallId: string,
    confirmed: boolean,
    input: { artifactId?: string; versionNo?: number | null },
  ) => Promise<void>;
  /** F-5: Tier budget SLO 게이트에서 role 별 에스컬레이션 동작 분기용. */
  role?: ChatShellRole;
};

function MessageRow({
  message,
  openedArtifactId,
  onOpenArtifact,
  onNavigate,
  onArchiveApproval,
  onApplyArtifactEditApproval,
  role,
}: MessageRowProps) {
  const isUser = message.role === "user";
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);
  const [applyBusyId, setApplyBusyId] = useState<string | null>(null);

  // F-2 후속: AI SDK useChat 이 CSR 초기 state 계산 시 MCP tool parts 를
  // 내부 재가공하여 SSR/CSR 트리가 엇갈리는 hydration mismatch 회귀가 발생함.
  // tool 카드 렌더를 mount 이후로 지연시켜 서버·클라이언트 초기 트리를 동일하게
  // 맞춘다(서버=텍스트만, 클라 초기=텍스트만 → mount 후 tool card 재렌더).
  const [toolCardsMounted, setToolCardsMounted] = useState(false);
  useEffect(() => {
    setToolCardsMounted(true);
  }, []);

  // Phase T v1 #2: getScores 성공 시 우측 Artifact 패널에 자동 오픈.
  // sessionStorage 로 toolCallId dedupe — 첫 도착 시 1회만, 페이지 리로드
  // 후에는 auto-open skip (사용자가 의도적으로 다시 보러 오지 않은 상태이므로).
  useEffect(() => {
    if (isUser) return;
    for (const part of message.parts) {
      if (!matchesTool(part, "getScores")) continue;
      const p = part as {
        state?: string;
        output?: unknown;
        input?: { grade?: number; semester?: number };
        toolCallId?: string;
      };
      if (p.state !== "output-available") continue;
      const toolCallId = p.toolCallId;
      if (!toolCallId) continue;

      if (typeof window !== "undefined") {
        const STORAGE_KEY = "ai-chat-auto-pushed-artifacts";
        let seen: string[] = [];
        try {
          seen = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
        } catch {
          seen = [];
        }
        if (seen.includes(toolCallId)) continue;
        const next = [...seen, toolCallId].slice(-50);
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // storage 접근 실패 시에도 auto-open 은 진행 (이번 세션에 한정).
        }
      }

      const output = extractToolOutput<GetScoresOutput>(p.output);
      if (!output?.ok || output.count === 0) continue;

      onOpenArtifact({
        id: `scores:${toolCallId}`,
        type: "scores",
        title: `${output.studentName ?? "학생"} 내신 성적`,
        subtitle: [
          output.filter.grade ? `${output.filter.grade}학년` : null,
          output.filter.semester ? `${output.filter.semester}학기` : null,
          `${output.count}과목`,
        ]
          .filter(Boolean)
          .join(" · "),
        props: output,
        originPath:
          output.filter.grade && output.filter.semester
            ? `/scores/school/${output.filter.grade}/${output.filter.semester}`
            : "/scores",
      });
      break; // 한 메시지당 최대 1개 artifact 만 push
    }
    // message.parts 전체가 아닌 길이 기준으로 의존성 한정 — parts 내용 변동 시에도 동작
  }, [isUser, message.parts, onOpenArtifact]);

  const respondArchive = async (
    toolCallId: string,
    confirmed: boolean,
  ) => {
    if (archiveBusyId) return;
    setArchiveBusyId(toolCallId);
    try {
      await onArchiveApproval(toolCallId, confirmed);
    } finally {
      setArchiveBusyId(null);
    }
  };

  const respondApplyArtifactEdit = async (
    toolCallId: string,
    confirmed: boolean,
    input: { artifactId?: string; versionNo?: number | null },
  ) => {
    if (applyBusyId) return;
    setApplyBusyId(toolCallId);
    try {
      await onApplyArtifactEditApproval(toolCallId, confirmed, input);
    } finally {
      setApplyBusyId(null);
    }
  };

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
          if (toolCardsMounted && matchesTool(p, "getScores") && "state" in p) {
            const state = toolState(p.state);
            const output =
              state === "success"
                ? extractToolOutput<GetScoresOutput>(p.output)
                : undefined;
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

          if (toolCardsMounted && matchesTool(p, "archiveConversation") && "state" in p) {
            const rawState = p.state;
            const input = "input" in p ? (p.input as { reason?: string }) : undefined;
            const output =
              rawState === "output-available"
                ? extractToolOutput<ArchiveConversationOutput>(p.output)
                : undefined;

            // input-available: 서버가 tool call 을 스트리밍 완료, 승인 대기.
            if (rawState === "input-available") {
              const busy = archiveBusyId === p.toolCallId;
              return (
                <ToolCard
                  key={i}
                  name="archiveConversation"
                  icon={<Archive size={14} />}
                  state="running"
                  summary={input?.reason ?? "현재 대화를 보관 처리"}
                  footer={
                    <InlineConfirm
                      title="이 대화를 보관할까요?"
                      description="보관된 대화는 사이드바 기본 목록에서 숨겨집니다. 언제든 복원할 수 있어요."
                      confirmLabel="보관"
                      tone="destructive"
                      busy={busy}
                      onConfirm={() => respondArchive(p.toolCallId, true)}
                      onCancel={() => respondArchive(p.toolCallId, false)}
                    />
                  }
                />
              );
            }

            const cardState = toolState(rawState);
            const summary =
              output?.ok === true
                ? "대화를 보관했어요"
                : output?.ok === false
                  ? output.reason
                  : input?.reason ?? "보관 준비 중";

            return (
              <ToolCard
                key={i}
                name="archiveConversation"
                icon={<Archive size={14} />}
                state={output?.ok === false ? "error" : cardState}
                summary={summary}
                errorText={output?.ok === false ? output.reason : undefined}
              />
            );
          }

          // Phase C-3 Sprint 2: applyArtifactEdit HITL 카드.
          // archiveConversation 과 동일 패턴 — execute 없는 tool 이라
          // state='input-available' 에서 InlineConfirm 으로 사용자 승인 수집,
          // 승인 시 서버 액션 호출 → addToolResult 로 LLM resume.
          if (
            toolCardsMounted &&
            matchesTool(p, "applyArtifactEdit") &&
            "state" in p
          ) {
            const rawState = p.state;
            const input =
              "input" in p
                ? (p.input as {
                    artifactId?: string;
                    versionNo?: number | null;
                  })
                : undefined;
            const output =
              rawState === "output-available"
                ? extractToolOutput<ApplyArtifactEditOutput>(p.output)
                : undefined;

            if (rawState === "input-available") {
              const busy = applyBusyId === p.toolCallId;
              const versionLabel = input?.versionNo
                ? `v${input.versionNo}`
                : "최신 버전";
              return (
                <ToolCard
                  key={i}
                  name="applyArtifactEdit"
                  icon={<Archive size={14} />}
                  state="running"
                  summary={`편집된 성적 ${versionLabel} 을 원본 DB 에 적용`}
                  footer={
                    <InlineConfirm
                      title="편집된 성적을 원본 DB 에 적용할까요?"
                      description="이 작업은 되돌릴 수 없습니다. student_internal_scores 테이블의 원점수·등급이 새 값으로 덮어쓰기됩니다."
                      confirmLabel="적용"
                      tone="destructive"
                      busy={busy}
                      onConfirm={() =>
                        respondApplyArtifactEdit(p.toolCallId, true, input ?? {})
                      }
                      onCancel={() =>
                        respondApplyArtifactEdit(p.toolCallId, false, input ?? {})
                      }
                    />
                  }
                />
              );
            }

            const cardState = toolState(rawState);
            const summary =
              output?.ok === true
                ? `${output.appliedCount}건 적용${
                    output.skippedCount > 0
                      ? ` · ${output.skippedCount}건 스킵`
                      : ""
                  }`
                : output?.ok === false
                  ? output.reason
                  : "적용 준비 중";

            return (
              <ToolCard
                key={i}
                name="applyArtifactEdit"
                icon={<Archive size={14} />}
                state={output?.ok === false ? "error" : cardState}
                summary={summary}
                errorText={output?.ok === false ? output.reason : undefined}
              />
            );
          }

          if (toolCardsMounted && matchesTool(p, "analyzeRecord") && "state" in p) {
            const state = toolState(p.state);
            const input = "input" in p
              ? (p.input as { studentName?: string })
              : undefined;
            const output =
              state === "success"
                ? extractToolOutput<AnalyzeRecordOutput>(p.output)
                : undefined;

            const summary = output
              ? output.ok
                ? `${output.studentName ?? "학생"} · ${statusLabel(output.status)}`
                : output.reason
              : input?.studentName
                ? `${input.studentName} 분석 조회 중`
                : "분석 조회 중";

            const canNavigate = output?.ok === true;

            return (
              <ToolCard
                key={i}
                name="analyzeRecord"
                icon={<FileSearch size={14} />}
                state={output?.ok === false ? "error" : state}
                summary={summary}
                errorText={output?.ok === false ? output.reason : undefined}
                footer={
                  canNavigate ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(output.detailPath)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <ExternalLink size={12} />
                      상세 · 분석 관리
                    </button>
                  ) : null
                }
              >
                {output && output.ok ? (
                  <RecordAnalysisCard output={output} />
                ) : null}
              </ToolCard>
            );
          }

          if (toolCardsMounted && matchesTool(p, "navigateTo") && "state" in p) {
            const rawState = toolState(p.state);
            const output =
              rawState === "success"
                ? extractToolOutput<NavigateToOutput>(p.output)
                : undefined;
            const isDenied = output?.ok === false;
            // role 거부는 success 상태지만 UX 상 error 로 표시
            const state = isDenied ? "error" : rawState;
            const isReady = rawState === "success" && output?.ok === true;
            const label = output?.path
              ? PATH_LABELS[output.path] ??
                (/^\/admin\/students\/[0-9a-f-]+(\/|$)/i.test(output.path)
                  ? "학생 상세"
                  : output.path)
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

          // Phase F-3: 신규 read tool 5종의 경량 ToolCard.
          // 전용 카드(ScoresCard/RecordAnalysisCard) 승격 전 1차 버전 — name + 1줄 summary.
          if (toolCardsMounted && matchesTool(p, "getPipelineStatus") && "state" in p) {
            const state = toolState(p.state);
            const output =
              state === "success"
                ? extractToolOutput<{
                    ok: boolean;
                    studentName?: string | null;
                    status?: string | null;
                    tasks?: Record<string, string> | null;
                    notStarted?: boolean;
                    reason?: string;
                  }>(p.output)
                : undefined;
            const tasks = output?.tasks ?? null;
            const completed = tasks
              ? Object.values(tasks).filter((t) => t === "completed").length
              : 0;
            const total = tasks ? Object.keys(tasks).length : 0;
            const summary = !output
              ? "조회 중"
              : output.ok === false
                ? (output.reason ?? "조회 실패")
                : output.notStarted
                  ? "파이프라인 미실행"
                  : `${output.status ?? "상태 없음"} · ${completed}/${total} 완료`;
            return (
              <ToolCard
                key={i}
                name="파이프라인 상태"
                icon={<Activity size={14} />}
                state={state}
                summary={summary}
                errorText={
                  output?.ok === false ? output.reason : undefined
                }
              >
                {output && output.ok && tasks && total > 0 ? (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {Object.entries(tasks).map(([key, s]) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[11px]">{key}</span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px]",
                            s === "completed"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : s === "running"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : s === "failed"
                                  ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                          )}
                        >
                          {s}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </ToolCard>
            );
          }

          if (toolCardsMounted && matchesTool(p, "getStudentRecords") && "state" in p) {
            const state = toolState(p.state);
            const output =
              state === "success"
                ? extractToolOutput<{
                    ok: boolean;
                    studentName?: string | null;
                    summary?: {
                      seteks: Array<{ subjectId: string | null; grade: number; semester: number; content: string }>;
                      personalSeteks: Array<{ title: string | null; grade: number; content: string }>;
                      changche: Array<{ activityType: string | null; grade: number; content: string }>;
                      haengteuk: { content: string } | null;
                      readings: Array<{ bookTitle: string | null; author: string | null; subjectArea: string | null; notes: string }>;
                      isEmpty: boolean;
                      schoolYear: number;
                    };
                    reason?: string;
                  }>(p.output)
                : undefined;
            const s = output?.summary;
            const summaryText = !output
              ? "조회 중"
              : output.ok === false
                ? (output.reason ?? "조회 실패")
                : s?.isEmpty
                  ? `${s.schoolYear} 기록 없음`
                  : `세특 ${s?.seteks.length ?? 0} · 창체 ${s?.changche.length ?? 0} · 독서 ${s?.readings.length ?? 0}${s?.haengteuk ? " · 행특" : ""}`;
            return (
              <ToolCard
                key={i}
                name="생기부 기록"
                icon={<BookOpen size={14} />}
                state={state}
                summary={summaryText}
                errorText={
                  output?.ok === false ? output.reason : undefined
                }
              >
                {s && !s.isEmpty ? (
                  <div className="flex flex-col gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    {s.seteks.length > 0 && (
                      <div>
                        <span className="font-medium">세특 {s.seteks.length}건</span>
                        <span className="ml-2 text-zinc-500">
                          {s.seteks.slice(0, 3).map((x) => `${x.grade}-${x.semester}`).join(", ")}
                          {s.seteks.length > 3 ? " …" : ""}
                        </span>
                      </div>
                    )}
                    {s.changche.length > 0 && (
                      <div>
                        <span className="font-medium">창체 {s.changche.length}건</span>
                        <span className="ml-2 text-zinc-500">
                          {[...new Set(s.changche.map((x) => x.activityType).filter(Boolean))].slice(0, 4).join(", ")}
                        </span>
                      </div>
                    )}
                    {s.readings.length > 0 && (
                      <div>
                        <span className="font-medium">독서 {s.readings.length}건</span>
                        <span className="ml-2 text-zinc-500">
                          {s.readings.slice(0, 2).map((r) => r.bookTitle).filter(Boolean).join(", ")}
                          {s.readings.length > 2 ? " …" : ""}
                        </span>
                      </div>
                    )}
                    {s.haengteuk && (
                      <div className="font-medium">행동특성 기록 있음</div>
                    )}
                  </div>
                ) : null}
              </ToolCard>
            );
          }

          if (toolCardsMounted && matchesTool(p, "getStudentDiagnosis") && "state" in p) {
            const state = toolState(p.state);
            const output =
              state === "success"
                ? extractToolOutput<{
                    ok: boolean;
                    studentName?: string | null;
                    aiDiagnosis?: {
                      overallGrade?: string | null;
                      strengths?: string[] | null;
                      weaknesses?: string[] | null;
                    } | null;
                    consultantDiagnosis?: {
                      overallGrade?: string | null;
                      strengths?: string[] | null;
                      weaknesses?: string[] | null;
                    } | null;
                    positiveTags?: unknown[];
                    negativeTags?: unknown[];
                    strategies?: Array<{ targetArea: string | null; content: string; status: string | null }>;
                    reason?: string;
                  }>(p.output)
                : undefined;
            const diag = output?.consultantDiagnosis ?? output?.aiDiagnosis ?? null;
            const overallGrade = diag?.overallGrade ?? null;
            const summary = !output
              ? "조회 중"
              : output.ok === false
                ? (output.reason ?? "조회 실패")
                : `종합 ${overallGrade ?? "—"} · 강점 ${output.positiveTags?.length ?? 0} · 약점 ${output.negativeTags?.length ?? 0}`;
            return (
              <ToolCard
                key={i}
                name="역량 진단"
                icon={<Award size={14} />}
                state={state}
                summary={summary}
                errorText={
                  output?.ok === false ? output.reason : undefined
                }
              >
                {output && output.ok && diag ? (
                  <div className="flex flex-col gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                    {diag.strengths && diag.strengths.length > 0 && (
                      <div>
                        <div className="mb-1 font-medium text-emerald-700 dark:text-emerald-300">강점</div>
                        <ul className="list-disc space-y-0.5 pl-5">
                          {diag.strengths.slice(0, 3).map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {diag.weaknesses && diag.weaknesses.length > 0 && (
                      <div>
                        <div className="mb-1 font-medium text-rose-700 dark:text-rose-300">보완점</div>
                        <ul className="list-disc space-y-0.5 pl-5">
                          {diag.weaknesses.slice(0, 3).map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </ToolCard>
            );
          }

          if (toolCardsMounted && matchesTool(p, "getStudentStorylines") && "state" in p) {
            const state = toolState(p.state);
            const output =
              state === "success"
                ? extractToolOutput<{
                    ok: boolean;
                    studentName?: string | null;
                    storylines?: Array<{
                      id: string;
                      title: string | null;
                      careerField: string | null;
                      keywords: string[] | null;
                    }>;
                    roadmapItems?: unknown[];
                    reason?: string;
                  }>(p.output)
                : undefined;
            const summary = !output
              ? "조회 중"
              : output.ok === false
                ? (output.reason ?? "조회 실패")
                : `스토리라인 ${output.storylines?.length ?? 0} · 로드맵 ${output.roadmapItems?.length ?? 0}`;
            return (
              <ToolCard
                key={i}
                name="탐구 스토리라인"
                icon={<GitBranch size={14} />}
                state={state}
                summary={summary}
                errorText={
                  output?.ok === false ? output.reason : undefined
                }
              >
                {output && output.ok && output.storylines && output.storylines.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {output.storylines.slice(0, 5).map((sl) => (
                      <li key={sl.id} className="flex flex-col">
                        <span className="font-medium">{sl.title ?? "(제목 없음)"}</span>
                        {sl.careerField && (
                          <span className="text-[11px] text-zinc-500">
                            {sl.careerField}
                            {sl.keywords && sl.keywords.length > 0
                              ? ` · ${sl.keywords.slice(0, 4).join(", ")}`
                              : ""}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </ToolCard>
            );
          }

          if (toolCardsMounted && matchesTool(p, "getStudentOverview") && "state" in p) {
            const state = toolState(p.state);
            const output =
              state === "success"
                ? extractToolOutput<{
                    ok: boolean;
                    overview?: {
                      name?: string | null;
                      grade?: number | null;
                      className?: string | null;
                      schoolName?: string | null;
                      targetMajor?: string | null;
                      recordSummary?: {
                        setekCount: number;
                        changcheCount: number;
                        readingCount: number;
                        hasHaengteuk: boolean;
                      };
                      diagnosis?: {
                        overallGrade: string | null;
                        strengths: string[];
                        weaknesses: string[];
                      };
                      storylines?: Array<{
                        title: string | null;
                        careerField: string | null;
                      }>;
                    };
                    reason?: string;
                  }>(p.output)
                : undefined;
            const o = output?.overview;
            const summary = !output
              ? "조회 중"
              : output.ok === false
                ? (output.reason ?? "조회 실패")
                : [
                    o?.name ?? "학생",
                    o?.grade ? `${o.grade}학년` : null,
                    o?.schoolName,
                    o?.targetMajor,
                  ]
                    .filter(Boolean)
                    .join(" · ");
            return (
              <ToolCard
                key={i}
                name="학생 프로필"
                icon={<UserIcon size={14} />}
                state={state}
                summary={summary}
                errorText={
                  output?.ok === false ? output.reason : undefined
                }
              >
                {o ? (
                  <div className="flex flex-col gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                    {o.recordSummary && (
                      <div>
                        <span className="font-medium">기록:</span>{" "}
                        세특 {o.recordSummary.setekCount} · 창체 {o.recordSummary.changcheCount} · 독서 {o.recordSummary.readingCount}
                        {o.recordSummary.hasHaengteuk ? " · 행특" : ""}
                      </div>
                    )}
                    {o.diagnosis && (
                      <div>
                        <span className="font-medium">진단:</span>{" "}
                        종합 {o.diagnosis.overallGrade ?? "—"}
                        {o.diagnosis.strengths.length > 0 && (
                          <span className="ml-1 text-emerald-700 dark:text-emerald-300">
                            · 강점 {o.diagnosis.strengths.length}
                          </span>
                        )}
                        {o.diagnosis.weaknesses.length > 0 && (
                          <span className="ml-1 text-rose-700 dark:text-rose-300">
                            · 약점 {o.diagnosis.weaknesses.length}
                          </span>
                        )}
                      </div>
                    )}
                    {o.storylines && o.storylines.length > 0 && (
                      <div>
                        <span className="font-medium">스토리라인:</span>{" "}
                        {o.storylines.slice(0, 3).map((sl) => sl.title).filter(Boolean).join(" · ")}
                        {o.storylines.length > 3 ? " …" : ""}
                      </div>
                    )}
                  </div>
                ) : null}
              </ToolCard>
            );
          }

          // Phase G S-2-b: 심층 분석 서브에이전트(analyzeRecordDeep) 진행·요약 카드.
          if (
            toolCardsMounted &&
            matchesTool(p, "analyzeRecordDeep") &&
            "state" in p
          ) {
            const state = toolState(p.state);
            const input =
              "input" in p
                ? (p.input as { studentName?: string; request?: string })
                : undefined;
            const output =
              state === "success"
                ? extractToolOutput<AnalyzeRecordDeepOutput>(p.output)
                : undefined;

            const progressLabel =
              state === "running"
                ? "심층 분석 중 (최대 45초)"
                : "분석 요청 준비 중";
            const requestSnippet = input?.request
              ? input.request.length > 40
                ? `${input.request.slice(0, 40)}…`
                : input.request
              : null;

            const summary = !output
              ? [input?.studentName, progressLabel, requestSnippet]
                  .filter(Boolean)
                  .join(" · ")
              : output.ok === false
                ? (output.reason ?? "분석 실패")
                : `${output.studentName ?? input?.studentName ?? "학생"} · ${output.stepCount}단계 · ${(
                    output.durationMs / 1000
                  ).toFixed(1)}초`;

            const ok = output?.ok === true ? output : null;

            return (
              <ToolCard
                key={i}
                name="심층 분석"
                icon={<Brain size={14} />}
                state={output?.ok === false ? "error" : state}
                summary={summary}
                errorText={output?.ok === false ? output.reason : undefined}
              >
                {ok ? (
                  <div className="flex flex-col gap-3 text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        결론
                      </div>
                      <div className="mt-0.5 font-medium">
                        {ok.summary.headline}
                      </div>
                    </div>
                    {ok.summary.keyFindings.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          주요 발견
                        </div>
                        <ul className="mt-1 flex flex-col gap-1 text-sm">
                          {ok.summary.keyFindings.map((f, idx) => (
                            <li
                              key={`${i}-kf-${idx}`}
                              className="flex gap-2"
                            >
                              <span className="text-zinc-400">•</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ok.summary.recommendedActions.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          추천 액션
                        </div>
                        <ul className="mt-1 flex flex-col gap-1 text-sm">
                          {ok.summary.recommendedActions.map((a, idx) => (
                            <li
                              key={`${i}-ra-${idx}`}
                              className="flex gap-2"
                            >
                              <span className="text-zinc-400">→</span>
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ok.summary.artifactIds.length > 0 && (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        관련 아티팩트: {ok.summary.artifactIds.join(", ")}
                      </div>
                    )}
                    {ok.summary.followUpQuestions &&
                      ok.summary.followUpQuestions.length > 0 && (
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            후속 질문 후보
                          </div>
                          <ul className="mt-1 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-300">
                            {ok.summary.followUpQuestions.map((q, idx) => (
                              <li
                                key={`${i}-fq-${idx}`}
                                className="flex gap-2"
                              >
                                <span className="text-zinc-400">?</span>
                                <span>{q}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                ) : null}
              </ToolCard>
            );
          }

          // Phase G S-3-a: 수강 계획 설계 서브에이전트(designStudentPlan) 진행·요약 카드.
          if (
            toolCardsMounted &&
            matchesTool(p, "designStudentPlan") &&
            "state" in p
          ) {
            const state = toolState(p.state);
            const input =
              "input" in p
                ? (p.input as { studentName?: string; request?: string })
                : undefined;
            const output =
              state === "success"
                ? extractToolOutput<DesignStudentPlanOutput>(p.output)
                : undefined;

            const progressLabel =
              state === "running"
                ? "수강 계획 분석 중 (최대 40초)"
                : "계획 요청 준비 중";
            const requestSnippet = input?.request
              ? input.request.length > 40
                ? `${input.request.slice(0, 40)}…`
                : input.request
              : null;

            const summary = !output
              ? [input?.studentName, progressLabel, requestSnippet]
                  .filter(Boolean)
                  .join(" · ")
              : output.ok === false
                ? (output.reason ?? "수강 계획 설계 실패")
                : `${output.studentName ?? input?.studentName ?? "학생"} · ${output.stepCount}단계 · ${(
                    output.durationMs / 1000
                  ).toFixed(1)}초`;

            const ok = output?.ok === true ? output : null;

            return (
              <ToolCard
                key={i}
                name="수강 계획 설계"
                icon={<CalendarClock size={14} />}
                state={output?.ok === false ? "error" : state}
                summary={summary}
                errorText={output?.ok === false ? output.reason : undefined}
              >
                {ok ? (
                  <div className="flex flex-col gap-3 text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        결론
                      </div>
                      <div className="mt-0.5 font-medium">
                        {ok.summary.headline}
                      </div>
                      {typeof ok.summary.adequacyScore === "number" && (
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          교과이수적합도 {ok.summary.adequacyScore}점
                        </div>
                      )}
                    </div>
                    {ok.summary.keyFindings.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          주요 발견
                        </div>
                        <ul className="mt-1 flex flex-col gap-1 text-sm">
                          {ok.summary.keyFindings.map((f, idx) => (
                            <li
                              key={`${i}-pkf-${idx}`}
                              className="flex gap-2"
                            >
                              <span className="text-zinc-400">•</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ok.summary.conflicts.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-rose-500 dark:text-rose-400">
                          충돌
                        </div>
                        <ul className="mt-1 flex flex-col gap-1 text-sm">
                          {ok.summary.conflicts.map((c, idx) => (
                            <li
                              key={`${i}-pc-${idx}`}
                              className="flex gap-2 text-rose-700 dark:text-rose-300"
                            >
                              <span>⚠</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ok.summary.recommendedCourses.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          추천 과목
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {ok.summary.recommendedCourses.map((c, idx) => (
                            <span
                              key={`${i}-prc-${idx}`}
                              className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {ok.summary.recommendedActions.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          추천 액션
                        </div>
                        <ul className="mt-1 flex flex-col gap-1 text-sm">
                          {ok.summary.recommendedActions.map((a, idx) => (
                            <li
                              key={`${i}-pra-${idx}`}
                              className="flex gap-2"
                            >
                              <span className="text-zinc-400">→</span>
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ok.summary.artifactIds.length > 0 && (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        관련 아티팩트: {ok.summary.artifactIds.join(", ")}
                      </div>
                    )}
                    {ok.summary.followUpQuestions &&
                      ok.summary.followUpQuestions.length > 0 && (
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            후속 질문 후보
                          </div>
                          <ul className="mt-1 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-300">
                            {ok.summary.followUpQuestions.map((q, idx) => (
                              <li
                                key={`${i}-pfq-${idx}`}
                                className="flex gap-2"
                              >
                                <span className="text-zinc-400">?</span>
                                <span>{q}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                ) : null}
              </ToolCard>
            );
          }

          // Phase G S-3-b: 입시 배치·면접·교차지원 서브에이전트(analyzeAdmission) 진행·요약 카드.
          if (
            toolCardsMounted &&
            matchesTool(p, "analyzeAdmission") &&
            "state" in p
          ) {
            const state = toolState(p.state);
            const input =
              "input" in p
                ? (p.input as { studentName?: string; request?: string })
                : undefined;
            const output =
              state === "success"
                ? extractToolOutput<AnalyzeAdmissionOutput>(p.output)
                : undefined;

            const progressLabel =
              state === "running"
                ? "입시 분석 중 (최대 55초)"
                : "입시 분석 준비 중";
            const requestSnippet = input?.request
              ? input.request.length > 40
                ? `${input.request.slice(0, 40)}…`
                : input.request
              : null;

            const summary = !output
              ? [input?.studentName, progressLabel, requestSnippet]
                  .filter(Boolean)
                  .join(" · ")
              : output.ok === false
                ? (output.reason ?? "입시 분석 실패")
                : `${output.studentName ?? input?.studentName ?? "학생"} · ${output.stepCount}단계 · ${(
                    output.durationMs / 1000
                  ).toFixed(1)}초`;

            const ok = output?.ok === true ? output : null;

            return (
              <ToolCard
                key={i}
                name="입시 분석"
                icon={<Target size={14} />}
                state={output?.ok === false ? "error" : state}
                summary={summary}
                errorText={output?.ok === false ? output.reason : undefined}
              >
                {ok ? (
                  <div className="flex flex-col gap-3 text-sm text-zinc-700 dark:text-zinc-200">
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/60">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        결론
                      </div>
                      <div className="mt-0.5 font-medium">
                        {ok.summary.headline}
                      </div>
                    </div>
                    {ok.summary.recommendedUniversities.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          추천 대학·학과
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {ok.summary.recommendedUniversities.map((u, idx) => (
                            <span
                              key={`${i}-aru-${idx}`}
                              className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            >
                              {u}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {ok.summary.keyFindings.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          주요 발견
                        </div>
                        <ul className="mt-1 flex flex-col gap-1 text-sm">
                          {ok.summary.keyFindings.map((f, idx) => (
                            <li
                              key={`${i}-akf-${idx}`}
                              className="flex gap-2"
                            >
                              <span className="text-zinc-400">•</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ok.summary.strategyNotes.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          전략 메모
                        </div>
                        <ul className="mt-1 flex flex-col gap-1 text-sm">
                          {ok.summary.strategyNotes.map((s, idx) => (
                            <li
                              key={`${i}-asn-${idx}`}
                              className="flex gap-2"
                            >
                              <span className="text-zinc-400">◆</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ok.summary.warnings.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-amber-500 dark:text-amber-400">
                          주의
                        </div>
                        <ul className="mt-1 flex flex-col gap-1 text-sm">
                          {ok.summary.warnings.map((w, idx) => (
                            <li
                              key={`${i}-aw-${idx}`}
                              className="flex gap-2 text-amber-700 dark:text-amber-300"
                            >
                              <span>⚠</span>
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ok.summary.recommendedActions.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          추천 액션
                        </div>
                        <ul className="mt-1 flex flex-col gap-1 text-sm">
                          {ok.summary.recommendedActions.map((a, idx) => (
                            <li
                              key={`${i}-ara-${idx}`}
                              className="flex gap-2"
                            >
                              <span className="text-zinc-400">→</span>
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ok.summary.artifactIds.length > 0 && (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        관련 아티팩트: {ok.summary.artifactIds.join(", ")}
                      </div>
                    )}
                    {ok.summary.followUpQuestions &&
                      ok.summary.followUpQuestions.length > 0 && (
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            후속 질문 후보
                          </div>
                          <ul className="mt-1 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-300">
                            {ok.summary.followUpQuestions.map((q, idx) => (
                              <li
                                key={`${i}-afq-${idx}`}
                                className="flex gap-2"
                              >
                                <span className="text-zinc-400">?</span>
                                <span>{q}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                ) : null}
              </ToolCard>
            );
          }

          return null;
        })}

        {!isUser && (
          <MessageCitationsSlot
            message={message}
            openedArtifactId={openedArtifactId}
            onOpenArtifact={onOpenArtifact}
            onNavigate={onNavigate}
          />
        )}
        {!isUser && (
          <EscalationBanner
            message={message}
            role={role}
            onNavigate={onNavigate}
          />
        )}
        {!isUser && <MessageMetaBadge metadata={message.metadata} />}
      </div>
    </div>
  );
}

/**
 * Phase C-4 (2026-04-21): assistant 메시지 말미 citation pill slot.
 *
 * extractCitations 는 parts 만으로 근거 라벨을 뽑지만, pill 클릭 시 패널을
 * 열려면 실제 tool output props 가 필요하다. 여기서 (citation → message.parts
 * 매칭 part → Artifact 객체) 로 resolve 한다.
 *
 * activeKey 는 현재 패널에 열린 artifactId 와 citation 의 resolved id 를
 * 교차해 "지금 이 근거가 패널에 열려 있는가" 를 계산 — tool card 의
 * "패널에 열림" 라벨과 동일 규약.
 */
function MessageCitationsSlot({
  message,
  openedArtifactId,
  onOpenArtifact,
  onNavigate,
}: {
  message: UIMessage;
  openedArtifactId: string | null;
  onOpenArtifact: MessageRowProps["onOpenArtifact"];
  onNavigate: (path: string) => void;
}) {
  const citations = useMemo(
    () => extractCitations(message.parts),
    [message.parts],
  );

  const resolvedById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof resolveCitationToArtifact>>();
    for (const c of citations) {
      const artifact = resolveCitationToArtifact(message, c);
      map.set(`${c.type}::${c.subjectKey}`, artifact);
    }
    return map;
  }, [citations, message]);

  if (citations.length === 0) return null;

  const activeKey =
    openedArtifactId != null
      ? ([...resolvedById.entries()].find(
          ([, a]) => a?.id === openedArtifactId,
        )?.[0] ?? null)
      : null;

  return (
    <MessageCitations
      citations={citations}
      activeKey={activeKey}
      onPillClick={(c) => {
        const artifact = resolvedById.get(`${c.type}::${c.subjectKey}`);
        if (artifact) {
          onOpenArtifact(artifact);
        } else if (c.originPath) {
          onNavigate(c.originPath);
        }
      }}
    />
  );
}

/**
 * citation → message.parts 매칭 output → ArtifactPanel 이 요구하는 최종 Artifact.
 *
 * 같은 tool 이 한 메시지 안에서 여러 번 호출되면 마지막 호출 결과를 채택
 * (dedup 규약 = extractCitations 와 동일, 마지막 우선).
 * output-available 가 아닌 part 는 제외. 정상 output 이 전혀 없으면 null
 * 반환 → 상위가 originPath 로 폴백.
 */
function resolveCitationToArtifact(
  message: UIMessage,
  citation: MessageCitation,
): Parameters<MessageRowProps["onOpenArtifact"]>[0] | null {
  let matched: {
    output: unknown;
    toolCallId?: string;
  } | null = null;
  for (const rawPart of message.parts) {
    if (!matchesTool(rawPart, citation.tool)) continue;
    const p = rawPart as {
      state?: string;
      output?: unknown;
      toolCallId?: string;
    };
    if (p.state !== "output-available") continue;
    matched = { output: p.output, toolCallId: p.toolCallId };
  }
  if (!matched) return null;

  const idSuffix = matched.toolCallId ?? citation.subjectKey;

  if (citation.type === "scores") {
    const output = extractToolOutput<GetScoresOutput>(matched.output);
    if (!output?.ok) return null;
    const subtitle = [
      output.filter.grade ? `${output.filter.grade}학년` : null,
      output.filter.semester ? `${output.filter.semester}학기` : null,
      `${output.count}과목`,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      id: `scores:${idSuffix}`,
      type: "scores",
      title: `${output.studentName ?? "학생"} 내신 성적`,
      subtitle,
      props: output,
      originPath:
        output.filter.grade && output.filter.semester
          ? `/scores/school/${output.filter.grade}/${output.filter.semester}`
          : "/scores",
    };
  }

  if (citation.type === "analysis") {
    const output = extractToolOutput<AnalyzeRecordOutput>(matched.output);
    if (!output?.ok) return null;
    return {
      id: `analysis:${idSuffix}`,
      type: "analysis",
      title: `${output.studentName ?? "학생"} 생기부 분석`,
      subtitle: citation.detail ?? undefined,
      props: output,
      originPath: output.detailPath ?? citation.originPath ?? undefined,
    };
  }

  if (citation.type === "plan") {
    const output = extractToolOutput<DesignStudentPlanOutput>(matched.output);
    if (!output?.ok) return null;
    return {
      id: `plan:${idSuffix}`,
      type: "plan",
      title: `${output.studentName ?? "학생"} 수강 계획`,
      subtitle: citation.detail ?? undefined,
      props: output,
      originPath: citation.originPath ?? undefined,
    };
  }

  if (citation.type === "blueprint") {
    const output = extractToolOutput<GetBlueprintOutput>(matched.output);
    if (!output?.ok) return null;
    return {
      id: `blueprint:${idSuffix}`,
      type: "blueprint",
      title: `${output.studentName ?? "학생"} Blueprint — ${output.themeLabel}`,
      subtitle: citation.detail ?? undefined,
      props: output,
      originPath: citation.originPath ?? undefined,
    };
  }

  return null;
}

/**
 * F-5: Tier budget SLO 게이트.
 *
 * Chat Shell 은 Low-latency L2 영역. 응답이 5 초 초과 / tool 3회 이상 /
 * stepCountIs 도달(finishReason === "length") 중 하나라도 해당하면 복합 요청으로
 * 간주하고 배너 표시.
 *
 * Phase G S-3-c: 심층 분석·수강 계획·입시 분석은 모두 Shell 내부 서브에이전트
 * (analyzeRecordDeep / designStudentPlan / analyzeAdmission) 로 처리되므로
 * Agent 모드 전환은 **trace 확인** 용도로 좁혀졌다.
 *
 * admin/consultant/superadmin: "Trace 뷰 열기" 버튼 — /admin/agent 이동.
 * student/parent: 안내 문구만 (Agent 접근 권한 없음).
 */
const F5_SLO_DURATION_MS = 5_000;
const F5_SLO_TOOL_COUNT = 3;

function EscalationBanner({
  message,
  role,
  onNavigate,
}: {
  message: UIMessage;
  role?: ChatShellRole;
  onNavigate: (path: string) => void;
}) {
  const meta = (message.metadata ?? {}) as {
    durationMs?: number;
    finishReason?: string;
  };
  const toolCallCount = message.parts.filter((p) => {
    const t = (p as { type?: unknown }).type;
    return (
      typeof t === "string" && (t.startsWith("tool-") || t === "dynamic-tool")
    );
  }).length;

  const slowResponse =
    typeof meta.durationMs === "number" && meta.durationMs > F5_SLO_DURATION_MS;
  const manyTools = toolCallCount >= F5_SLO_TOOL_COUNT;
  const stepCapped = meta.finishReason === "length";

  if (!slowResponse && !manyTools && !stepCapped) return null;

  const reasons: string[] = [];
  if (slowResponse)
    reasons.push(`응답 ${(meta.durationMs! / 1000).toFixed(1)}s`);
  if (manyTools) reasons.push(`도구 ${toolCallCount}회`);
  if (stepCapped) reasons.push("단계 상한 도달");

  const canEscalate =
    role === "admin" || role === "consultant" || role === "superadmin";

  return (
    <div
      role="note"
      aria-label="복합 요청 안내"
      className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
    >
      <span className="font-medium">복합 요청 감지</span>
      <span className="text-amber-700 dark:text-amber-300">
        {reasons.join(" · ")}
      </span>
      {canEscalate ? (
        <button
          type="button"
          onClick={() => onNavigate("/admin/agent")}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-700"
        >
          Trace 뷰 열기
        </button>
      ) : (
        <span className="ml-auto text-[11px] text-amber-700/80 dark:text-amber-300/80">
          자세한 분석은 컨설턴트에게 문의하세요
        </span>
      )}
    </div>
  );
}

function MessageMetaBadge({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as {
    durationMs?: number;
    model?: string;
    toolCallCount?: number;
  };

  const parts: string[] = [];
  if (typeof m.durationMs === "number") {
    const sec = (m.durationMs / 1000).toFixed(1);
    parts.push(`⏱ ${sec}s`);
  }
  if (m.model) {
    parts.push(m.model.replace(/^ollama\//, ""));
  }
  if (typeof m.toolCallCount === "number" && m.toolCallCount > 0) {
    parts.push(`🔧 ${m.toolCallCount}`);
  }
  if (parts.length === 0) return null;

  return (
    <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-500">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center">
          {p}
        </span>
      ))}
    </div>
  );
}
