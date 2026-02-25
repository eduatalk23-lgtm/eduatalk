"use client";

import { useState } from "react";
import { X, Download, Share2, Bell } from "lucide-react";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";

interface InstallPromptProps {
  className?: string;
}

const STORAGE_KEY = "pwa-install-prompt-seen";

// 로컬 스토리지에서 이전에 본 기록 확인
function getInitialSeenState(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

/**
 * PWA 설치 프롬프트 배너 컴포넌트
 * Android: beforeinstallprompt 이벤트로 자동 표시
 * iOS: 비-standalone 모드에서 표시 (푸시 알림 안내 포함)
 */
export default function InstallPrompt({ className }: InstallPromptProps) {
  const { isInstallable, isInstalled, isIOS, isStandalone, install } =
    useInstallPrompt();
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasSeenPrompt] = useState(getInitialSeenState);

  // 표시 조건:
  // - Android/Desktop: beforeinstallprompt 이벤트 발생 시 (isInstallable)
  // - iOS: standalone이 아닌 경우 (Safari에서 앱 미설치 상태)
  const canShow = isInstallable || (isIOS && !isStandalone);

  if (isInstalled || isDismissed || hasSeenPrompt || !canShow) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  const handleInstall = async () => {
    await install();
    localStorage.setItem(STORAGE_KEY, "true");
  };

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-secondary-900 border-t border-secondary-200 dark:border-secondary-800 shadow-[var(--elevation-8)]",
        "animate-in slide-in-from-bottom duration-300",
        className
      )}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center gap-2">
              {isIOS ? (
                <Bell className="w-5 h-5 text-info-600 dark:text-info-400" />
              ) : (
                <Download className="w-5 h-5 text-info-600 dark:text-info-400" />
              )}
              <h3 className="text-body-2-bold text-text-primary">
                {isIOS ? "푸시 알림 받기" : "앱 설치하기"}
              </h3>
            </div>
            <p className="text-body-2 text-text-secondary">
              {isIOS
                ? "홈 화면에 추가하면 학습 알림과 채팅 알림을 받을 수 있어요"
                : "홈 화면에 추가하여 오프라인에서도 사용하세요"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isIOS && (
              <Button onClick={handleInstall} variant="primary" size="sm">
                설치
              </Button>
            )}
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="xs"
              aria-label="닫기"
              className="p-2"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {isIOS && (
          <div className="flex flex-col gap-3 pt-3 border-t border-secondary-200 dark:border-secondary-800">
            <div className="flex items-start gap-2 text-body-2 text-text-secondary">
              <Share2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="text-body-2-bold">설치 방법:</p>
                <ol className="list-decimal list-inside flex flex-col gap-1 ml-2">
                  <li>
                    하단 공유 버튼 <Share2 className="w-3 h-3 inline" /> 클릭
                  </li>
                  <li>&quot;홈 화면에 추가&quot; 선택</li>
                  <li>추가된 앱에서 알림 권한을 허용</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

