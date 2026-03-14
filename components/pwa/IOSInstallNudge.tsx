"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Share, Plus, Bell, CalendarClock } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  dismissIOSNudge,
  type IOSNudgeContext,
} from "@/lib/pwa/iosInstallNudge";

const CONTEXT_CONFIG: Record<
  IOSNudgeContext,
  { title: string; description: string; Icon: typeof Bell }
> = {
  chat: {
    title: "채팅 알림을 놓치지 마세요",
    description:
      "홈 화면에 앱을 추가하면 브라우저를 닫아도 새 메시지 알림을 받을 수 있어요.",
    Icon: Bell,
  },
  reminder: {
    title: "일정 알림을 놓치지 마세요",
    description:
      "홈 화면에 앱을 추가하면 일정 시작 전 알림을 받을 수 있어요.",
    Icon: CalendarClock,
  },
  general: {
    title: "알림을 놓치지 마세요",
    description:
      "홈 화면에 앱을 추가하면 중요한 알림을 실시간으로 받을 수 있어요.",
    Icon: Bell,
  },
};

/**
 * iOS Safari 전용 앱 설치 유도 bottom sheet.
 *
 * `ios-install-nudge` custom event를 수신하여 컨텍스트별 메시지로 표시합니다.
 * 채팅 알림 수신, 리마인더 설정 등 Push 알림이 필요한 순간에 트리거됩니다.
 */
export function IOSInstallNudge() {
  const [context, setContext] = useState<IOSNudgeContext | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ context: IOSNudgeContext }>).detail;
      setContext(detail.context);
    };
    window.addEventListener("ios-install-nudge", handler);
    return () => window.removeEventListener("ios-install-nudge", handler);
  }, []);

  const handleDismiss = useCallback(() => {
    dismissIOSNudge();
    setContext(null);
  }, []);

  if (!context) return null;

  const config = CONTEXT_CONFIG[context];
  const { Icon } = config;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 animate-in fade-in duration-200"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={config.title}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[61]",
          "rounded-t-2xl bg-white shadow-2xl dark:bg-gray-900",
          "animate-in slide-in-from-bottom duration-300"
        )}
      >
        <div className="flex flex-col gap-5 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
          {/* Handle bar */}
          <div className="mx-auto h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/30">
              <Icon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {config.title}
            </h2>
            <p className="max-w-[280px] text-sm text-gray-600 dark:text-gray-400">
              {config.description}
            </p>
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <Step number={1}>
              Safari 하단의{" "}
              <InlineIcon>
                <Share className="inline h-4 w-4" />
                공유
              </InlineIcon>{" "}
              버튼을 탭하세요
            </Step>
            <Step number={2}>
              스크롤하여{" "}
              <InlineIcon>
                <Plus className="inline h-4 w-4" />
                홈 화면에 추가
              </InlineIcon>
              를 선택하세요
            </Step>
            <Step number={3}>
              오른쪽 상단{" "}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                추가
              </span>
              를 탭하면 완료!
            </Step>
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </>
  );
}

function Step({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
        {number}
      </span>
      <span className="pt-0.5 text-sm text-gray-700 dark:text-gray-300">
        {children}
      </span>
    </div>
  );
}

function InlineIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle font-semibold text-indigo-600 dark:text-indigo-400">
      {children}
    </span>
  );
}
