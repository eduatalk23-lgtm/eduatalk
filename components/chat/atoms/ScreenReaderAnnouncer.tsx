"use client";

/**
 * ScreenReaderAnnouncer - 스크린 리더용 실시간 알림 컴포넌트
 *
 * 시각적으로는 숨겨져 있지만 스크린 리더가 새 메시지나
 * 상태 변경을 읽어줄 수 있도록 합니다.
 *
 * @example
 * ```tsx
 * <ScreenReaderAnnouncer
 *   message="김철수님이 새 메시지를 보냈습니다"
 *   politeness="polite"
 * />
 * ```
 */

import { memo, useEffect, useState } from "react";

interface ScreenReaderAnnouncerProps {
  /** 알림 메시지 (변경 시 스크린 리더가 읽음) */
  message: string | null;
  /** 알림 우선순위 (polite: 현재 읽기 후, assertive: 즉시) */
  politeness?: "polite" | "assertive";
  /** 알림 클리어 딜레이 (밀리초) */
  clearDelay?: number;
}

function ScreenReaderAnnouncerComponent({
  message,
  politeness = "polite",
  clearDelay = 1000,
}: ScreenReaderAnnouncerProps) {
  const [announcement, setAnnouncement] = useState<string>("");

  useEffect(() => {
    if (message) {
      // 새 메시지 설정 (스크린 리더가 읽음)
      setAnnouncement(message);

      // 일정 시간 후 클리어 (중복 읽기 방지)
      const timer = setTimeout(() => {
        setAnnouncement("");
      }, clearDelay);

      return () => clearTimeout(timer);
    }
  }, [message, clearDelay]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

export const ScreenReaderAnnouncer = memo(ScreenReaderAnnouncerComponent);

/**
 * 새 메시지 알림 포맷터
 */
export function formatNewMessageAnnouncement(
  senderName: string,
  content: string,
  isOwn: boolean
): string {
  if (isOwn) {
    return `메시지 전송됨: ${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`;
  }
  return `${senderName}님의 새 메시지: ${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`;
}

/**
 * 타이핑 알림 포맷터
 */
export function formatTypingAnnouncement(users: { name: string }[]): string | null {
  if (users.length === 0) return null;
  if (users.length === 1) {
    return `${users[0].name}님이 입력 중입니다`;
  }
  if (users.length === 2) {
    return `${users[0].name}님과 ${users[1].name}님이 입력 중입니다`;
  }
  return `${users[0].name}님 외 ${users.length - 1}명이 입력 중입니다`;
}

/**
 * 연결 상태 알림 포맷터
 */
export function formatConnectionAnnouncement(
  status: "connected" | "disconnected" | "reconnecting"
): string {
  switch (status) {
    case "connected":
      return "채팅 연결됨";
    case "disconnected":
      return "채팅 연결이 끊겼습니다. 재연결 버튼을 누르거나 인터넷 연결을 확인해주세요.";
    case "reconnecting":
      return "채팅 재연결 중입니다";
    default:
      return "";
  }
}
