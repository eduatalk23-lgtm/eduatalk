"use client";

/**
 * Phase T 글로벌 GUI↔AI 토글 FAB
 *
 * 모든 페이지 우하단에 고정 원형 버튼. 현재 위치를 감지해 반대 환경으로 전환.
 *
 * - GUI 에 있을 때: "💬 대화방" — 클릭 시 /ai-chat (lastChatId 있으면 복원)
 * - /ai-chat 에 있을 때: "🏠 메인" — 클릭 시 lastGuiPath (없으면 "/")
 * - 양쪽 모두 전환 직전 경로·ID 를 modeToggleStore 에 저장해 왕복 시 위치 정확
 * - Cmd+\ (Mac) / Ctrl+\ (Win/Linux) 단축키 지원
 * - 인증 전 페이지(/login, /signup 등) 에서는 렌더 안 함
 */

import { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MessageSquareText, Home } from "lucide-react";
import { useModeToggleStore } from "@/lib/stores/modeToggleStore";
import { useSplitChatStore } from "@/lib/stores/splitChatStore";
import { cn } from "@/lib/cn";

const UNAUTH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/onboarding",
  "/student-setup",
  "/offline",
  "/pay",
  "/shared",
  "/landing",
  "/join",
  "/invite",
] as const;

function isUnauthenticatedPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return UNAUTH_PREFIXES.some((p) => pathname.startsWith(p));
}

export function GlobalModeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const hydrate = useModeToggleStore((s) => s.hydrate);
  const lastGuiPath = useModeToggleStore((s) => s.lastGuiPath);
  const lastChatId = useModeToggleStore((s) => s.lastChatId);
  const setLastGuiPath = useModeToggleStore((s) => s.setLastGuiPath);
  const setLastChatId = useModeToggleStore((s) => s.setLastChatId);
  const splitOpen = useSplitChatStore((s) => s.open);

  const inChat = pathname?.startsWith("/ai-chat") ?? false;
  const hidden = isUnauthenticatedPath(pathname);

  // 초기 sessionStorage hydrate (client mount 시 1회)
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 페이지 이동 추적 — GUI 위치는 즉시 저장, /ai-chat 에 있을 때는 conversationId 저장
  useEffect(() => {
    if (!pathname) return;
    if (hidden) return;
    if (inChat) {
      // /ai-chat?id=xxx 에서 id 추출
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        if (id) setLastChatId(id);
      }
    } else {
      // GUI 경로 저장 (쿼리 포함)
      const full =
        typeof window !== "undefined"
          ? pathname + window.location.search
          : pathname;
      setLastGuiPath(full);
    }
  }, [pathname, inChat, hidden, setLastGuiPath, setLastChatId]);

  const onToggle = useMemo(
    () => () => {
      if (inChat) {
        // /ai-chat → GUI 복귀. lastGuiPath 우선, 없으면 proxy role 리다이렉트
        router.push(lastGuiPath ?? "/");
      } else {
        // GUI → /ai-chat. 저장된 대화 ID 있으면 복원, 없으면 새 대화
        if (lastChatId) {
          router.push(`/ai-chat?id=${encodeURIComponent(lastChatId)}`);
        } else {
          router.push("/ai-chat");
        }
      }
    },
    [inChat, lastGuiPath, lastChatId, router],
  );

  // Cmd+\ / Ctrl+\ 단축키
  useEffect(() => {
    if (hidden) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hidden, onToggle]);

  if (hidden) return null;
  // split 패널 열려 있으면 FAB 숨김 (이미 대화 중 + 오른쪽 패널과 시각 경쟁)
  if (splitOpen) return null;

  const label = inChat ? "메인 화면으로" : "AI 대화방으로";
  const Icon = inChat ? Home : MessageSquareText;
  const shortcut =
    typeof navigator !== "undefined" && /Mac/.test(navigator.platform)
      ? "⌘\\"
      : "Ctrl+\\";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={`${label} (${shortcut})`}
      // 위치: 기존 ChatFAB(right-4 md:right-6, bottom-6, h-12 md:h-14) 바로 위에 수직 스택.
      // 사이즈와 오프셋을 ChatFAB 와 동일하게 매칭하여 시각적 정렬.
      className={cn(
        "fixed right-4 z-[46] inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 md:right-6 md:h-14 md:w-14",
        "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-24",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400",
        inChat
          ? "bg-white text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800"
          : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
      )}
    >
      <Icon size={18} className="md:scale-110" />
    </button>
  );
}
