"use client";

import { Link2, ChevronRight } from "lucide-react";
import type { RangeTabProps } from "./types";

/**
 * 범위(목차) 탭
 *
 * 연결된 콘텐츠의 학습 범위를 표시하고 수정할 수 있습니다.
 */
export function RangeTab({ slot, editable, onOpenRangeModal }: RangeTabProps) {
  if (!slot.content_id) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Link2 className="mb-3 h-8 w-8 text-gray-300" />
        <div className="text-sm text-gray-500">
          먼저 &quot;콘텐츠 연결&quot; 탭에서
          <br />
          콘텐츠를 연결해주세요
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 연결된 콘텐츠 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="mb-1 text-xs font-medium text-gray-500">
          연결된 콘텐츠
        </div>
        <div className="text-sm font-medium text-gray-800">{slot.title}</div>
      </div>

      {/* 현재 범위 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 text-sm font-medium text-gray-700">학습 범위</div>

        {slot.start_range !== undefined && slot.end_range !== undefined ? (
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-lg bg-blue-50 p-3 text-center">
                <div className="text-xs text-blue-600">시작</div>
                <div className="text-lg font-semibold text-blue-800">
                  {slot.start_range}
                  {slot.slot_type === "book" ? "p" : "회차"}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
              <div className="flex-1 rounded-lg bg-blue-50 p-3 text-center">
                <div className="text-xs text-blue-600">끝</div>
                <div className="text-lg font-semibold text-blue-800">
                  {slot.end_range}
                  {slot.slot_type === "book" ? "p" : "회차"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-lg border-2 border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
            범위가 설정되지 않았습니다
          </div>
        )}

        {editable && (
          <button
            type="button"
            onClick={onOpenRangeModal}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            범위 {slot.start_range !== undefined ? "수정" : "설정"}
          </button>
        )}
      </div>
    </div>
  );
}
