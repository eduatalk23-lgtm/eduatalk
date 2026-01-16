/**
 * MessageSkeleton - 메시지 로딩 스켈레톤
 *
 * 채팅 메시지 로딩 중 표시되는 스켈레톤 UI
 */

import { cn } from "@/lib/cn";

interface MessageSkeletonProps {
  /** 스켈레톤 개수 */
  count?: number;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 메시지 스켈레톤 컴포넌트
 */
export function MessageSkeleton({ count = 5, className }: MessageSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-4 p-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5 animate-fade-in">
          {/* 발신자 이름 */}
          <div className="w-20 h-3 bg-secondary-200 dark:bg-secondary-700 animate-pulse rounded" />

          {/* 메시지 내용 (가변 너비로 자연스러움 연출) */}
          <div
            className={cn(
              "h-16 bg-secondary-200 dark:bg-secondary-700 animate-pulse rounded-2xl",
              i % 3 === 0 ? "w-[60%]" : i % 3 === 1 ? "w-[75%]" : "w-[50%]"
            )}
          />

          {/* 시간 표시 */}
          <div className="w-12 h-2 bg-secondary-200 dark:bg-secondary-700 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
