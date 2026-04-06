"use client";

import { useState, useRef, useEffect } from "react";
import { X, LogOut } from "lucide-react";
import { useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { layoutStyles } from "@/components/navigation/global/navStyles";
import { Avatar } from "@/components/atoms/Avatar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { OfflineStatusIndicator } from "@/components/ui/OfflineStatusIndicator";
import { signOut } from "@/lib/domains/auth/actions";
import { getCheckInStatus } from "@/lib/domains/checkin";

type ProfileMenuProps = {
  userName?: string | null;
  profileImageUrl?: string | null;
  userEmail?: string | null;
  roleLabel: string;
  tenantInfo?: { name: string; type?: string } | null;
  settingsHref?: string;
};

export function ProfileMenu({
  userName,
  profileImageUrl,
  userEmail,
  roleLabel,
  tenantInfo,
  settingsHref = "/settings",
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [checkInTitle, setCheckInTitle] = useState<string | null>(null);

  // 학생 역할일 때만 칭호 조회
  const isStudent = roleLabel === "학생";
  useEffect(() => {
    if (!isStudent) return;
    getCheckInStatus().then((result) => {
      if (result.success && result.data?.currentTitle) {
        setCheckInTitle(result.data.currentTitle);
      }
    });
  }, [isStudent]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleSignOut = () => {
    startTransition(async () => {
      try {
        await signOut();
      } catch {
        // 세션 만료 등으로 signOut 실패해도 로그아웃 진행
      }
      window.location.href = "/login";
    });
  };

  const displayName = userName || "사용자";

  return (
    <div className="relative" ref={menuRef}>
      {/* 트리거: Avatar (구글 스타일 원형 프로필) */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-center rounded-full cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        aria-label="프로필 메뉴"
        aria-expanded={isOpen}
      >
        <Avatar
          src={profileImageUrl}
          name={displayName}
          size="sm"
          variant="circle"
        />
      </button>

      {/* 드롭다운 (구글 스타일) */}
      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-[320px] rounded-2xl overflow-hidden",
            "bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]",
            "border border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]",
            "shadow-xl"
          )}
        >
          {/* 상단: 이메일 + 닫기 */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className={cn("text-sm truncate", layoutStyles.textMuted)}>
              {userEmail || ""}
            </p>
            <button
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                layoutStyles.hoverBg,
                layoutStyles.textSecondary
              )}
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 중앙: 큰 아바타 + 인사 + 역할 */}
          <div className="flex flex-col items-center gap-3 px-4 pt-2 pb-4">
            <Avatar
              src={profileImageUrl}
              name={displayName}
              size="xl"
              variant="circle"
            />
            <div className="flex flex-col items-center gap-0.5">
              <p className={cn("text-lg font-medium", layoutStyles.textHeading)}>
                안녕하세요, {displayName}님
              </p>
              <p className={cn("text-sm", layoutStyles.textMuted)}>
                {roleLabel}
                {tenantInfo && ` · ${tenantInfo.name}`}
              </p>
              {checkInTitle && (
                <span className="mt-1 inline-flex rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {checkInTitle}
                </span>
              )}
            </div>

            {/* 계정 관리 버튼 (구글 스타일 pill) */}
            <Link
              href={settingsHref}
              onClick={() => setIsOpen(false)}
              className={cn(
                "px-5 py-1.5 rounded-full text-sm font-medium transition-colors",
                "border border-[rgb(var(--color-secondary-300))] dark:border-[rgb(var(--color-secondary-600))]",
                layoutStyles.textSecondary,
                "hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-800))]"
              )}
            >
              계정 관리
            </Link>
          </div>

          {/* 구분선 */}
          <div className={layoutStyles.borderTop} />

          {/* 설정 액션 */}
          <div className="px-4 py-3 flex items-center justify-between">
            <ThemeToggle />
            <OfflineStatusIndicator variant="minimal" />
          </div>

          {/* 구분선 */}
          <div className={layoutStyles.borderTop} />

          {/* 로그아웃 */}
          <div className="p-3">
            <button
              onClick={handleSignOut}
              disabled={isPending}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm transition-colors",
                layoutStyles.hoverBg,
                layoutStyles.textSecondary,
                layoutStyles.hoverText,
                "disabled:opacity-50"
              )}
            >
              <LogOut className="w-4 h-4" />
              <span>{isPending ? "로그아웃 중..." : "로그아웃"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
