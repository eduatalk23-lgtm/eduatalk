"use client";

/**
 * DateDivider - 날짜 구분선 컴포넌트
 *
 * 채팅 메시지 목록에서 날짜가 바뀌는 지점에 표시됩니다.
 */

import { memo } from "react";

interface DateDividerProps {
  /** 포맷된 날짜 텍스트 (예: "2024년 1월 15일 월요일") */
  date: string;
}

function DateDividerComponent({ date }: DateDividerProps) {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="flex items-center gap-3 w-full max-w-md">
        {/* 왼쪽 선 */}
        <div className="flex-1 h-px bg-secondary-200 dark:bg-secondary-700" />

        {/* 날짜 텍스트 */}
        <span className="text-xs text-text-tertiary font-medium px-2 whitespace-nowrap">
          {date}
        </span>

        {/* 오른쪽 선 */}
        <div className="flex-1 h-px bg-secondary-200 dark:bg-secondary-700" />
      </div>
    </div>
  );
}

export const DateDivider = memo(DateDividerComponent);
