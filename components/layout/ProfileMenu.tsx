"use client";

import { useState, useRef, useEffect } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/cn";
import { profileMenuStyles, layoutStyles } from "@/components/navigation/global/navStyles";
import { SignOutButton } from "@/app/_components/SignOutButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { OfflineStatusIndicator } from "@/components/ui/OfflineStatusIndicator";

type ProfileMenuProps = {
  userName?: string | null;
  roleLabel: string;
  tenantInfo?: { name: string; type?: string } | null;
  userId?: string | null;
};

export function ProfileMenu({ userName, roleLabel, tenantInfo }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={profileMenuStyles.trigger}
        aria-label="프로필 메뉴"
        aria-expanded={isOpen}
      >
        <User className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className={profileMenuStyles.dropdown}>
          {/* 사용자 정보 */}
          <div className="p-4 space-y-1">
            <p className={cn("text-body-2 font-semibold", layoutStyles.textHeading)}>
              {userName || "사용자"}
            </p>
            <p className={cn("text-sm", layoutStyles.textMuted)}>
              {roleLabel}
            </p>
            {tenantInfo && (
              <p className={cn("text-sm", layoutStyles.textMuted)}>
                {tenantInfo.name}
                {tenantInfo.type && ` · ${tenantInfo.type}`}
              </p>
            )}
          </div>

          {/* 구분선 */}
          <div className={layoutStyles.borderTop} />

          {/* 액션 */}
          <div className="p-3 space-y-1">
            <div className={cn(layoutStyles.flexBetween, "px-1")}>
              <ThemeToggle />
              <OfflineStatusIndicator variant="minimal" />
            </div>
          </div>

          <div className={layoutStyles.borderTop} />

          <div className="p-3">
            <SignOutButton variant="compact" />
          </div>
        </div>
      )}
    </div>
  );
}
