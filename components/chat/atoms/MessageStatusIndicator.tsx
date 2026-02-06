/**
 * MessageStatusIndicator - 메시지 전송 상태 표시기
 *
 * WhatsApp/Telegram 스타일의 메시지 상태 표시
 * - sending: 시계 아이콘 (전송 중)
 * - sent: 단일 체크 (서버 수신)
 * - delivered: 이중 체크 (전달됨)
 * - read: 파란색 이중 체크 (읽음)
 * - error: 빨간색 느낌표 (실패)
 */

import { memo } from "react";
import { cn } from "@/lib/cn";
import { AlertCircle, Clock } from "lucide-react";

/** 메시지 전송 상태 */
export type MessageDeliveryStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "error"
  | "queued";

interface MessageStatusIndicatorProps {
  /** 메시지 상태 */
  status: MessageDeliveryStatus;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 단일 체크 아이콘 (SVG)
 */
function SingleCheck({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M13.5 4.5L6 12L2.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 이중 체크 아이콘 (SVG)
 */
function DoubleCheck({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 8.5L5.5 12L13 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 8.5L10.5 12L18 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 메시지 상태 표시기 컴포넌트
 */
function MessageStatusIndicatorComponent({
  status,
  className,
}: MessageStatusIndicatorProps) {
  const baseClass = "w-4 h-4 flex-shrink-0";

  switch (status) {
    case "sending":
      return (
        <Clock
          className={cn(baseClass, "text-text-tertiary animate-pulse", className)}
          aria-label="전송 중"
        />
      );

    case "sent":
      return (
        <SingleCheck
          className={cn(baseClass, "text-text-tertiary", className)}
        />
      );

    case "delivered":
      return (
        <DoubleCheck
          className={cn(baseClass, "text-text-tertiary", className)}
        />
      );

    case "read":
      return (
        <DoubleCheck
          className={cn(baseClass, "text-primary", className)}
        />
      );

    case "queued":
      return (
        <Clock
          className={cn(baseClass, "text-text-tertiary", className)}
          aria-label="대기 중"
        />
      );

    case "error":
      return (
        <AlertCircle
          className={cn(baseClass, "text-error", className)}
          aria-label="전송 실패"
        />
      );

    default:
      return null;
  }
}

export const MessageStatusIndicator = memo(MessageStatusIndicatorComponent);

/**
 * 상태별 설명 텍스트 (접근성/툴팁용)
 */
export const MESSAGE_STATUS_LABELS: Record<MessageDeliveryStatus, string> = {
  sending: "전송 중",
  sent: "전송됨",
  delivered: "전달됨",
  read: "읽음",
  error: "전송 실패",
  queued: "대기 중",
};
