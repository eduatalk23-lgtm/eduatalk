"use client";

import React from "react";

/**
 * AllocationSourceBadge - 할당 소스 배지
 * 
 * 폴백 메커니즘 정보를 표시하는 배지 컴포넌트
 */

type AllocationSourceBadgeProps = {
  source: "content" | "subject" | "default";
  isSubjectMode?: boolean;
  className?: string;
};

export function AllocationSourceBadge({
  source,
  isSubjectMode = false,
  className = "",
}: AllocationSourceBadgeProps) {
  // 교과 단위 모드일 때는 항상 표시하지 않음 (교과 단위 설정이 적용 중이므로)
  if (isSubjectMode) {
    return null;
  }

  // 콘텐츠별 설정일 때는 표시하지 않음
  if (source === "content") {
    return null;
  }

  const getMessage = () => {
    if (source === "subject") {
      return "교과별 설정 적용 중";
    }
    if (source === "default") {
      return "기본값 (취약과목)";
    }
    return null;
  };

  const message = getMessage();
  if (!message) {
    return null;
  }

  return (
    <div className={`text-xs text-gray-600 ${className}`}>{message}</div>
  );
}

