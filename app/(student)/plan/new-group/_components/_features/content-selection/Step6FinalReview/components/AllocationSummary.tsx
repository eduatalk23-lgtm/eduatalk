"use client";

import React from "react";

/**
 * AllocationSummary - 설정 요약
 * 
 * 전략과목/취약과목 설정 요약 정보를 표시하는 컴포넌트
 */

type AllocationSummaryProps = {
  contentAllocationsCount: number;
  subjectAllocationsCount: number;
};

export function AllocationSummary({
  contentAllocationsCount,
  subjectAllocationsCount,
}: AllocationSummaryProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <h4 className="text-xs font-semibold text-blue-800">설정 요약</h4>
      <div className="flex flex-col gap-1 text-xs text-blue-800">
        <p>• 콘텐츠별 설정: {contentAllocationsCount}개</p>
        <p>• 교과별 설정 (폴백): {subjectAllocationsCount}개</p>
        <p className="text-blue-800">
          콘텐츠별 설정이 우선 적용되며, 설정되지 않은 콘텐츠는 교과별 설정을
          따릅니다.
        </p>
      </div>
    </div>
  );
}

