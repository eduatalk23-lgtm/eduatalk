"use client";

import { useEffect, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { cn } from "@/lib/cn";

interface InstallPromptProps {
  className?: string;
}

/**
 * PWA 설치 프롬프트 배너 컴포넌트
 * 자동으로 표시되며, 사용자가 닫거나 설치하면 숨겨집니다.
 */
export default function InstallPrompt({ className }: InstallPromptProps) {
  const { isInstallable, isInstalled, isIOS, install } = useInstallPrompt();
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasSeenPrompt, setHasSeenPrompt] = useState(false);

  useEffect(() => {
    // 로컬 스토리지에서 이전에 본 기록 확인
    const seen = localStorage.getItem("pwa-install-prompt-seen");
    if (seen === "true") {
      setHasSeenPrompt(true);
    }
  }, []);

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
        "fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg",
        "animate-in slide-in-from-bottom duration-300",
        className
      )}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {isIOS ? (
                <Share2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              )}
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                앱 설치하기
              </h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {isIOS
                ? "홈 화면에 추가하여 더 빠르게 접근하세요"
                : "홈 화면에 추가하여 오프라인에서도 사용하세요"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                설치
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isIOS && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Share2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">설치 방법:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
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

