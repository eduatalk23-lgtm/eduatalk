"use client";

/**
 * Phase T-3: Split Chat Panel
 *
 * 현재 페이지를 유지하면서 우측 슬라이드 오버레이로 AI 대화를 제공.
 * splitChatStore 의 open/conversationId/handoffInput 을 구독.
 *
 * 흐름:
 * 1. openSplit() 호출 → 패널 열림 + POST /api/ai-chat/handoff/initialize
 * 2. 성공 응답(bannerOrigin, suggestionChips, existing 여부)
 * 3. 서버가 ai_conversations + ai_messages (선공) 저장
 * 4. 클라이언트는 /api/chat 을 호출하는 ChatShell(variant="split") 에 위임
 *    - initialMessages 은 선공 메시지를 즉시 표시하기 위해 buildHandoffOpener 를 클라이언트에서
 *      다시 호출하지 않고, 서버 응답의 openerMessageId 기반으로 loadConversationMessages 를
 *      거치지 않는 단순 접근: 비어있는 initialMessages 로 시작하고 useChat 이 첫 메시지
 *      스트리밍 전에 이미 저장된 선공 메시지를 DB 에서 반영하지 못함. 대안: loadMessages API 호출.
 *
 * v0 구현 정책: 단순성 우선 — 패널이 열릴 때 /api/ai-chat/messages?id= 로 기존 메시지를 한 번 더 로드.
 *
 * 키보드: Esc 닫기. 포커스 트랩 미적용(본문과 자유롭게 오감).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UIMessage } from "ai";
import { useSplitChatStore } from "@/lib/stores/splitChatStore";
import { ChatShell, type ChatBannerOrigin } from "@/components/ai-chat/ChatShell";
import { cn } from "@/lib/cn";

type InitializeResponse =
  | {
      ok: true;
      isExisting: boolean;
      bannerOrigin: ChatBannerOrigin;
      suggestionChips: Array<{ category: string; text: string }>;
      resolvedStudentId: string | null;
    }
  | { ok: false; reason: string };

export function SplitChatPanel() {
  const router = useRouter();
  const open = useSplitChatStore((s) => s.open);
  const conversationId = useSplitChatStore((s) => s.conversationId);
  const handoffInput = useSplitChatStore((s) => s.handoffInput);
  const closeSplit = useSplitChatStore((s) => s.closeSplit);
  const reset = useSplitChatStore((s) => s.reset);

  const [initialized, setInitialized] = useState(false);
  const [bannerOrigin, setBannerOrigin] = useState<ChatBannerOrigin | null>(
    null,
  );
  const [suggestionChips, setSuggestionChips] = useState<
    Array<{ category: string; text: string }>
  >([]);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastConversationIdRef = useRef<string | null>(null);

  // 패널 열림 시 handoff initialize + 기존 메시지 로드
  useEffect(() => {
    if (!open || !conversationId || !handoffInput) return;
    if (lastConversationIdRef.current === conversationId) return;
    lastConversationIdRef.current = conversationId;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai-chat/handoff/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            ...handoffInput,
          }),
        });
        const json = (await res.json()) as InitializeResponse;
        if (cancelled) return;
        if (!json.ok) {
          setError(json.reason);
          return;
        }
        setBannerOrigin(json.bannerOrigin);
        setSuggestionChips(json.suggestionChips);

        // 저장된 선공 메시지(기타) 로드
        const msgRes = await fetch(
          `/api/ai-chat/messages?id=${encodeURIComponent(conversationId)}`,
          { cache: "no-store" },
        );
        if (msgRes.ok) {
          const msgJson = (await msgRes.json()) as { messages: UIMessage[] };
          if (!cancelled) setInitialMessages(msgJson.messages ?? []);
        }
        setInitialized(true);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, conversationId, handoffInput]);

  // Esc 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSplit();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, closeSplit]);

  // 패널 완전히 닫힐 때 상태 리셋 (닫힘 애니메이션 고려해 딜레이)
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      lastConversationIdRef.current = null;
      setInitialized(false);
      setBannerOrigin(null);
      setSuggestionChips([]);
      setInitialMessages([]);
    }, 300);
    return () => clearTimeout(t);
  }, [open]);

  const handleExpand = () => {
    if (!conversationId) return;
    closeSplit();
    router.push(`/ai-chat?id=${encodeURIComponent(conversationId)}`);
  };

  if (!open && !initialized) return null;

  return (
    <>
      {/* 배경 반투명 레이어 (클릭 시 닫기). 본문을 완전 가리지 않음 */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/10 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => closeSplit()}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="false"
        aria-label="AI 대화 패널"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-white shadow-2xl transition-transform duration-200 dark:bg-zinc-950",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {loading && !initialized ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-zinc-500">
            AI 대화를 준비하는 중…
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-red-600">
              대화를 열지 못했어요: {error}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              닫기
            </button>
          </div>
        ) : conversationId && initialized ? (
          <ChatShell
            variant="split"
            conversationId={conversationId}
            initialMessages={initialMessages}
            conversations={[]}
            bannerOrigin={bannerOrigin}
            suggestionChips={
              suggestionChips.length > 0 ? suggestionChips : undefined
            }
            onClose={closeSplit}
            onExpand={handleExpand}
          />
        ) : null}
      </aside>
    </>
  );
}
