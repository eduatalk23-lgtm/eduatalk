"use client";

import { Download, Share2, Check } from "lucide-react";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";

import type { ButtonVariant, ButtonSize } from "@/components/atoms/Button";

interface InstallButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  showIcon?: boolean;
}

/**
 * PWA 설치 버튼 컴포넌트
 * 수동으로 설치를 트리거할 때 사용합니다.
 */
export default function InstallButton({
  variant = "primary",
  size = "md",
  className,
  showIcon = true,
}: InstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = useInstallPrompt();

  // 이미 설치되었거나 설치 불가능한 경우 버튼 숨김
  if (isInstalled || (!isInstallable && !isIOS)) {
    return null;
  }

  const handleClick = async () => {
    if (isIOS) {
      // iOS는 자동 설치 불가능하므로 안내 메시지 표시
      alert(
        "iOS Safari에서 설치하려면:\n\n1. 하단 공유 버튼(□↑) 클릭\n2. '홈 화면에 추가' 선택"
      );
      return;
    }

    await install();
  };

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={cn(className)}
    >
      <div className="flex items-center gap-2">
        {showIcon &&
          (isIOS ? (
            <Share2 className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          ))}
        <span>{isInstalled ? "설치됨" : isIOS ? "설치 안내" : "앱 설치하기"}</span>
        {isInstalled && <Check className="w-4 h-4" />}
      </div>
    </Button>
  );
}

