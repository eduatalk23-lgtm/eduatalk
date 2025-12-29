"use client";

import type { BatchModeBannerProps } from "./types";

/**
 * 일괄 조정 모드 안내 배너
 */
export function BatchModeBanner({
  contentCount,
  onEnableBatchMode,
}: BatchModeBannerProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <h3 className="font-medium text-blue-900">
              일괄 조정 모드를 사용하시겠습니까?
            </h3>
          </div>
          <p className="text-sm text-blue-700">
            {contentCount}개의 콘텐츠를 선택하셨습니다. 일괄 조정 모드를
            사용하면 모든 콘텐츠를 한 번에 조정할 수 있습니다.
          </p>
          <div className="text-xs text-blue-600">
            예시: 모든 콘텐츠의 범위를 10% 증가시키거나, 모든 콘텐츠에 +5페이지
            추가
          </div>
        </div>
        <button
          onClick={onEnableBatchMode}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          일괄 조정 시작
        </button>
      </div>
    </div>
  );
}
