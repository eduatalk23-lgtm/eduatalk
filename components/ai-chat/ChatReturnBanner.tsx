"use client";

/**
 * Phase T-2a GUI 복귀 배너
 *
 * AI 대화에서 navigateTo 로 GUI 페이지로 이동한 직후 상단 고정 배너.
 * URL 쿼리 `?fromChat=<conversationId>` 존재 시에만 렌더.
 *
 * - 사용자가 원래 대화로 돌아갈 수 있는 "대화 계속" 액션 제공
 * - 닫기 시 sessionStorage 에 dismissed 기록 (같은 conversationId 에 대해 1회 숨김)
 * - 전역 Providers 안쪽에 마운트되어 모든 페이지에서 동작
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MessageSquareText, X } from "lucide-react";

const STORAGE_PREFIX = "chat-return-dismissed:";

export function ChatReturnBanner() {
  const searchParams = useSearchParams();
  const fromChat = searchParams.get("fromChat");
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!fromChat) return;
    try {
      const stored = sessionStorage.getItem(STORAGE_PREFIX + fromChat);
      if (stored === "1") setDismissed(true);
    } catch {
      // sessionStorage 접근 실패는 배너 표시 유지
    }
  }, [fromChat]);

  const handleDismiss = () => {
    if (!fromChat) return;
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_PREFIX + fromChat, "1");
    } catch {
      // 저장 실패는 무시
    }
  };

  if (!mounted || !fromChat || dismissed) return null;

  return (
    <div
      role="note"
      aria-label="AI 대화로 돌아가기"
      className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-900 px-4 py-2 text-white md:px-6 dark:border-zinc-700"
    >
      <div className="flex items-center gap-2 text-[12px]">
        <MessageSquareText size={13} className="text-zinc-300" />
        <span>이 화면은 AI 대화에서 이동했어요.</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Link
          href={`/ai-chat?id=${encodeURIComponent(fromChat)}`}
          className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20"
        >
          대화 계속 ▸
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="배너 닫기"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
