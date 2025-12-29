"use client";

import type { BatchModeToggleProps } from "./types";

/**
 * 일괄 조정 모드 토글
 */
export function BatchModeToggle({ enabled, onChange }: BatchModeToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium text-gray-900">일괄 조정 모드</h3>
        <p className="text-xs text-gray-600">
          여러 콘텐츠를 한 번에 조정할 수 있습니다.
        </p>
      </div>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-gray-700">
          일괄 조정 활성화
        </span>
      </label>
    </div>
  );
}
