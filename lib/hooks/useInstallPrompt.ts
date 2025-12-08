"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface UseInstallPromptReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  prompt: (() => Promise<void>) | null;
  install: () => Promise<void>;
}

/**
 * PWA 설치 프롬프트를 관리하는 훅
 * iOS Safari와 Android Chrome 모두 지원
 */
export function useInstallPrompt(): UseInstallPromptReturn {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // iOS 감지
    const iOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream;
    setIsIOS(iOS);

    // Standalone 모드 감지 (이미 설치됨)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    setIsInstalled(standalone);

    // beforeinstallprompt 이벤트 리스너 (Android Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // appinstalled 이벤트 리스너 (설치 완료)
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error("PWA 설치 중 오류 발생:", error);
    }
  };

  return {
    isInstallable: isInstallable && !isInstalled,
    isInstalled,
    isIOS,
    isStandalone,
    prompt: deferredPrompt ? install : null,
    install,
  };
}

