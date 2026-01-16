"use client";

/**
 * TypingIndicator - 타이핑 중 표시
 *
 * 다른 사용자가 메시지를 입력 중일 때 표시합니다.
 */

import { memo } from "react";
import type { PresenceUser } from "@/lib/domains/chat/types";

interface TypingIndicatorProps {
  /** 타이핑 중인 사용자 목록 */
  users: PresenceUser[];
}

function TypingIndicatorComponent({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  // 최대 2명까지 이름 표시
  const displayNames =
    users.length <= 2
      ? users.map((u) => u.name).join(", ")
      : `${users[0].name} 외 ${users.length - 1}명`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-text-tertiary">
      {/* 애니메이션 점 */}
      <div className="flex items-center gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-bounce [animation-delay:300ms]" />
      </div>

      {/* 텍스트 */}
      <span>{displayNames}님이 입력 중...</span>
    </div>
  );
}

export const TypingIndicator = memo(TypingIndicatorComponent);
