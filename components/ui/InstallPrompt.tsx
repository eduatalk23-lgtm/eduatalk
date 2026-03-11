"use client";

import { useState } from "react";
import { X, Download, Share2, Bell, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";

interface InstallPromptProps {
  className?: string;
}

const STORAGE_KEY = "pwa-install-prompt-seen";
const SNOOZE_DAYS = 7;

// 로컬 스토리지에서 이전에 본 기록 확인 (7일 snooze)
function getInitialSeenState(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  // 레거시 "true" 값 호환: 영구 dismiss → 7일 snooze로 마이그레이션
  if (raw === "true") return false;
  const dismissedAt = parseInt(raw, 10);
  if (isNaN(dismissedAt)) return false;
  return Date.now() - dismissedAt < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
}

function getIsAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * PWA 설치 프롬프트 배너 컴포넌트
 * Android: beforeinstallprompt 이벤트로 자동 표시 + Play Protect 안내
 * iOS: 비-standalone 모드에서 표시 (푸시 알림 안내 포함)
 */
export default function InstallPrompt({ className }: InstallPromptProps) {
  const { isInstallable, isInstalled, isIOS, isStandalone, install } =
    useInstallPrompt();
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasSeenPrompt] = useState(getInitialSeenState);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [isAndroid] = useState(getIsAndroid);

  // 표시 조건:
  // - Android/Desktop: beforeinstallprompt 이벤트 발생 시 (isInstallable)
  // - iOS: standalone이 아닌 경우 (Safari에서 앱 미설치 상태)
  const canShow = isInstallable || (isIOS && !isStandalone);

  if (isInstalled || isDismissed || hasSeenPrompt || !canShow) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  };

  const handleInstall = async () => {
    await install();
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
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
                : "홈 화면에 추가하여 더 빠르게 접속하세요"}
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

        {/* iOS 설치 안내 */}
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

        {/* Android Play Protect 안내 */}
        {isAndroid && !isIOS && (
          <div className="pt-3 border-t border-secondary-200 dark:border-secondary-800">
            <button
              type="button"
              onClick={() => setShowAndroidGuide((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>설치 시 보안 경고가 나타나나요?</span>
              {showAndroidGuide ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showAndroidGuide && (
              <div className="mt-2 rounded-lg bg-secondary-50 dark:bg-secondary-800 p-3 text-xs text-text-secondary flex flex-col gap-2">
                <p>
                  Google Play 프로텍트에서 &quot;안전하지 않은 앱 차단됨&quot;
                  경고가 표시될 수 있습니다. 이 앱은 웹 기반 앱(PWA)으로,
                  브라우저에서 설치되기 때문에 나타나는 일반적인 안내입니다.
                </p>
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-text-primary">설치 방법:</p>
                  <ol className="list-decimal list-inside flex flex-col gap-1 ml-1">
                    <li>&quot;세부정보 더보기&quot;를 탭합니다</li>
                    <li>&quot;무시하고 설치&quot;를 탭합니다</li>
                  </ol>
                </div>
                <p className="text-text-tertiary">
                  앱 스토어 출시 전까지 표시될 수 있으며, 개인정보는 안전하게
                  보호됩니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

