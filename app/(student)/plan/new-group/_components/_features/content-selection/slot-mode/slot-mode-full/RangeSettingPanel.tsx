"use client";

import React, { memo, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import { ContentSlot } from "@/lib/types/content-selection";
import {
  FileText,
  ChevronRight,
  BookOpen,
  Video,
  List,
  Loader2,
  Check,
} from "lucide-react";
import { RangeSettingModal } from "../../components/RangeSettingModal";
import type { ContentRange } from "@/lib/types/content-selection";

// ============================================================================
// 타입 정의
// ============================================================================

type RangeSettingPanelProps = {
  selectedSlot: ContentSlot | null;
  slotIndex: number | null;
  onRangeUpdate: (slotIndex: number, range: { start: number; end: number }) => void;
  editable?: boolean;
  studentId?: string;
  className?: string;
};

// ============================================================================
// 메인 컴포넌트
// ============================================================================

function RangeSettingPanelComponent({
  selectedSlot,
  slotIndex,
  onRangeUpdate,
  editable = true,
  studentId,
  className,
}: RangeSettingPanelProps) {
  // 범위 입력 상태
  const [startValue, setStartValue] = useState<string>("");
  const [endValue, setEndValue] = useState<string>("");

  // 범위 모달 상태 (목차 조회용)
  const [showRangeModal, setShowRangeModal] = useState(false);

  // 슬롯 변경 시 입력값 동기화
  useEffect(() => {
    if (selectedSlot) {
      setStartValue(selectedSlot.start_range?.toString() || "");
      setEndValue(selectedSlot.end_range?.toString() || "");
    } else {
      setStartValue("");
      setEndValue("");
    }
  }, [selectedSlot?.slot_index, selectedSlot?.start_range, selectedSlot?.end_range]);

  // 범위 저장
  const handleSaveRange = useCallback(() => {
    if (slotIndex === null) return;

    const start = parseInt(startValue, 10);
    const end = parseInt(endValue, 10);

    if (isNaN(start) || isNaN(end)) return;
    if (start <= 0 || end <= 0) return;
    if (start > end) return;

    onRangeUpdate(slotIndex, { start, end });
  }, [slotIndex, startValue, endValue, onRangeUpdate]);

  // 모달에서 범위 저장
  const handleModalSave = useCallback(
    (range: ContentRange) => {
      if (slotIndex === null) return;

      const startNum = Number(range.start.replace(/[^\d]/g, ""));
      const endNum = Number(range.end.replace(/[^\d]/g, ""));

      if (!isNaN(startNum) && !isNaN(endNum)) {
        onRangeUpdate(slotIndex, { start: startNum, end: endNum });
      }
      setShowRangeModal(false);
    },
    [slotIndex, onRangeUpdate]
  );

  // 슬롯 미선택 또는 콘텐츠 미연결
  if (!selectedSlot || slotIndex === null) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText className="h-4 w-4" />
          범위
        </div>
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-4">
          <div className="text-center text-sm text-gray-400">
            슬롯을<br />선택하세요
          </div>
        </div>
      </div>
    );
  }

  // 자습/테스트는 범위 설정 불필요
  if (selectedSlot.slot_type === "self_study" || selectedSlot.slot_type === "test") {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText className="h-4 w-4" />
          범위
        </div>
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-4">
          <div className="text-center text-sm text-gray-400">
            범위 설정<br />불필요
          </div>
        </div>
      </div>
    );
  }

  const isBook = selectedSlot.slot_type === "book";
  const isLecture = selectedSlot.slot_type === "lecture";
  const unit = isBook ? "p" : "회차";
  const TypeIcon = isBook ? BookOpen : isLecture ? Video : FileText;

  // 콘텐츠 미연결이지만 범위 직접 설정 가능
  const isManualRangeMode = !selectedSlot.content_id;

  // 범위가 설정되어 있는지 확인
  const hasRange = selectedSlot.start_range !== undefined && selectedSlot.end_range !== undefined;

  // 입력값 유효성 검사
  const isValidInput = () => {
    const start = parseInt(startValue, 10);
    const end = parseInt(endValue, 10);
    return !isNaN(start) && !isNaN(end) && start > 0 && end > 0 && start <= end;
  };

  // 변경 여부 확인
  const hasChanges = () => {
    const start = parseInt(startValue, 10);
    const end = parseInt(endValue, 10);
    return start !== selectedSlot.start_range || end !== selectedSlot.end_range;
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* 헤더 */}
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
        <FileText className="h-4 w-4" />
        범위
        {isManualRangeMode && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            직접 입력
          </span>
        )}
      </div>

      {/* 콘텐츠 정보 또는 직접 입력 안내 */}
      <div className={cn(
        "mb-3 rounded-lg border p-2",
        isManualRangeMode ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"
      )}>
        <div className="flex items-center gap-1.5">
          <TypeIcon className={cn(
            "h-3.5 w-3.5 flex-shrink-0",
            isManualRangeMode ? "text-amber-600" : "text-gray-500"
          )} />
          <span className={cn(
            "truncate text-xs font-medium",
            isManualRangeMode ? "text-amber-700" : "text-gray-700"
          )}>
            {isManualRangeMode
              ? `${selectedSlot.subject_category || "미정"} - 범위 직접 입력`
              : selectedSlot.title}
          </span>
        </div>
      </div>

      {/* 범위 입력 */}
      <div className="flex-1 space-y-3">
        {/* 시작/끝 입력 */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-500">시작</label>
            <div className="relative">
              <input
                type="number"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                disabled={!editable}
                placeholder="1"
                min={1}
                className={cn(
                  "w-full rounded-lg border bg-white px-3 py-2 pr-8 text-sm",
                  "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                  !editable && "cursor-not-allowed opacity-60"
                )}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {unit}
              </span>
            </div>
          </div>

          <ChevronRight className="mt-5 h-4 w-4 flex-shrink-0 text-gray-400" />

          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-500">끝</label>
            <div className="relative">
              <input
                type="number"
                value={endValue}
                onChange={(e) => setEndValue(e.target.value)}
                disabled={!editable}
                placeholder="10"
                min={1}
                className={cn(
                  "w-full rounded-lg border bg-white px-3 py-2 pr-8 text-sm",
                  "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                  !editable && "cursor-not-allowed opacity-60"
                )}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {unit}
              </span>
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        {editable && isValidInput() && hasChanges() && (
          <button
            type="button"
            onClick={handleSaveRange}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Check className="h-4 w-4" />
            범위 저장
          </button>
        )}

        {/* 목차에서 선택 버튼 (콘텐츠 연결 시에만) */}
        {editable && !isManualRangeMode && (
          <button
            type="button"
            onClick={() => setShowRangeModal(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <List className="h-4 w-4" />
            목차에서 선택
          </button>
        )}

        {/* 현재 범위 표시 */}
        {hasRange && (
          <div className="rounded-lg bg-green-50 p-3">
            <div className="mb-1 text-xs text-green-600">현재 설정된 범위</div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg font-semibold text-green-700">
                {selectedSlot.start_range}{unit}
              </span>
              <ChevronRight className="h-4 w-4 text-green-500" />
              <span className="text-lg font-semibold text-green-700">
                {selectedSlot.end_range}{unit}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 범위 설정 모달 (목차 조회용) */}
      {showRangeModal && selectedSlot.content_id && (
        <RangeSettingModal
          open={showRangeModal}
          onClose={() => setShowRangeModal(false)}
          content={{
            id: selectedSlot.content_id,
            type: (selectedSlot.slot_type as "book" | "lecture") || "book",
            title: selectedSlot.title || "",
          }}
          isRecommendedContent={!!selectedSlot.master_content_id}
          onSave={handleModalSave}
          studentId={studentId}
        />
      )}
    </div>
  );
}

export const RangeSettingPanel = memo(RangeSettingPanelComponent);
