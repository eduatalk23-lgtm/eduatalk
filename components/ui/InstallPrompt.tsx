"use client";

import { useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { cn } from "@/lib/cn";

interface InstallPromptProps {
  className?: string;
}

// 로컬 스토리지에서 이전에 본 기록 확인
function getInitialSeenState(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("pwa-install-prompt-seen") === "true";
}

/**
 * PWA 설치 프롬프트 배너 컴포넌트
 * 자동으로 표시되며, 사용자가 닫거나 설치하면 숨겨집니다.
 */
export default function InstallPrompt({ className }: InstallPromptProps) {
  const { isInstallable, isInstalled, isIOS, install } = useInstallPrompt();
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasSeenPrompt] = useState(getInitialSeenState);

  // 이미 설치되었거나 닫혔거나 이미 본 경우 표시하지 않음
  if (isInstalled || isDismissed || hasSeenPrompt || !isInstallable) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("pwa-install-prompt-seen", "true");
  };

  const handleInstall = async () => {
    await install();
    localStorage.setItem("pwa-install-prompt-seen", "true");
  };

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-secondary-900 border-t border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-800))] shadow-[var(--elevation-8)]",
        "animate-in slide-in-from-bottom duration-300",
        className
      )}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center gap-2">
              {isIOS ? (
                <Share2 className="w-5 h-5 text-info-600 dark:text-info-400" />
              ) : (
                <Download className="w-5 h-5 text-info-600 dark:text-info-400" />
              )}
              <h3 className="text-body-2-bold text-text-primary">
                앱 설치하기
              </h3>
            </div>
            <p className="text-body-2 text-text-secondary">
              {isIOS
                ? "홈 화면에 추가하여 더 빠르게 접근하세요"
                : "홈 화면에 추가하여 오프라인에서도 사용하세요"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="px-4 py-2 bg-info-600 hover:bg-info-700 text-white text-body-2 font-medium rounded-lg transition-base"
              >
                설치
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-secondary)] transition-base"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isIOS && (
          <div className="flex flex-col gap-3 pt-3 border-t border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-800))]">
            <div className="flex items-start gap-2 text-body-2 text-text-secondary">
              <Share2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="text-body-2-bold">설치 방법:</p>
                <ol className="list-decimal list-inside flex flex-col gap-1 ml-2">
                  <li>하단 공유 버튼 <Share2 className="w-3 h-3 inline" /> 클릭</li>
                  <li>&quot;홈 화면에 추가&quot; 선택</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

