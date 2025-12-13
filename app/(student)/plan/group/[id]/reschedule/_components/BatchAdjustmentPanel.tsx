/**
 * 일괄 조정 패널 컴포넌트
 * 
 * 여러 콘텐츠를 한 번에 조정할 수 있는 UI를 제공합니다.
 */

"use client";

import { useState, useMemo } from "react";
import { applyBatchAdjustment, previewBatchAdjustment, type BatchAdjustmentConfig } from "@/lib/reschedule/batchAdjuster";
import type { PlanContent } from "@/lib/types/plan";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";

type BatchAdjustmentPanelProps = {
  contents: PlanContent[];
  selectedContentIds: Set<string>;
  onApply: (adjustments: AdjustmentInput[]) => void;
  onCancel: () => void;
};

export function BatchAdjustmentPanel({
  contents,
  selectedContentIds,
  onApply,
  onCancel,
}: BatchAdjustmentPanelProps) {
  const [adjustmentType, setAdjustmentType] = useState<"ratio" | "absolute">("ratio");
  const [ratio, setRatio] = useState<string>("1.0");
  const [absoluteChange, setAbsoluteChange] = useState<string>("0");

  const selectedContents = useMemo(() => {
    return contents.filter(
      (c) => selectedContentIds.has(c.id || c.content_id)
    );
  }, [contents, selectedContentIds]);

  // 미리보기 계산
  const preview = useMemo(() => {
    if (selectedContents.length === 0) {
      return null;
    }

    try {
      const config: BatchAdjustmentConfig = {
        type: adjustmentType,
        ratio: adjustmentType === "ratio" ? parseFloat(ratio) : undefined,
        absoluteChange: adjustmentType === "absolute" ? parseInt(absoluteChange) : undefined,
      };

      return previewBatchAdjustment(selectedContents, config);
    } catch (error) {
      return null;
    }
  }, [selectedContents, adjustmentType, ratio, absoluteChange]);

  const handleApply = () => {
    if (selectedContents.length === 0) {
      return;
    }

    try {
      const config: BatchAdjustmentConfig = {
        type: adjustmentType,
        ratio: adjustmentType === "ratio" ? parseFloat(ratio) : undefined,
        absoluteChange: adjustmentType === "absolute" ? parseInt(absoluteChange) : undefined,
      };

      const adjustments = applyBatchAdjustment(selectedContents, config);
      onApply(adjustments);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "일괄 조정 적용에 실패했습니다."
      );
    }
  };

  if (selectedContents.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-blue-900">일괄 조정</h3>
        <p className="text-xs text-blue-700">
          선택한 {selectedContents.length}개의 콘텐츠를 한 번에 조정합니다.
        </p>
      </div>

      {/* 조정 타입 선택 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="batchType"
              value="ratio"
              checked={adjustmentType === "ratio"}
              onChange={() => setAdjustmentType("ratio")}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">비율 조정</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="batchType"
              value="absolute"
              checked={adjustmentType === "absolute"}
              onChange={() => setAdjustmentType("absolute")}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">절대값 조정</span>
          </label>
        </div>

        {/* 비율 조정 입력 */}
        {adjustmentType === "ratio" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              조정 비율 (예: 1.1 = 10% 증가, 0.9 = 10% 감소)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="2.0"
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1.0"
            />
            <p className="text-xs text-gray-600">
              현재 비율: {ratio} ({((parseFloat(ratio) - 1) * 100).toFixed(1)}%)
            </p>
          </div>
        )}

        {/* 절대값 조정 입력 */}
        {adjustmentType === "absolute" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              절대값 변화 (양수 = 증가, 음수 = 감소)
            </label>
            <input
              type="number"
              value={absoluteChange}
              onChange={(e) => setAbsoluteChange(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
            <p className="text-xs text-gray-600">
              현재 변화: {absoluteChange >= "0" ? "+" : ""}
              {absoluteChange}
            </p>
          </div>
        )}
      </div>

      {/* 미리보기 */}
      {preview && (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-300 bg-white p-3">
          <h4 className="text-sm font-semibold text-gray-900">미리보기</h4>
          <div className="flex flex-col gap-1 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>영향받는 콘텐츠:</span>
              <span className="font-medium text-gray-900">
                {preview.affectedCount}개
              </span>
            </div>
            <div className="flex justify-between">
              <span>기존 총 범위:</span>
              <span className="font-medium text-gray-900">
                {preview.totalRangeBefore}
              </span>
            </div>
            <div className="flex justify-between">
              <span>변경 후 총 범위:</span>
              <span className="font-medium text-blue-600">
                {preview.totalRangeAfter}
              </span>
            </div>
            <div className="flex justify-between">
              <span>변화:</span>
              <span
                className={`font-medium ${
                  preview.rangeChange >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {preview.rangeChange >= 0 ? "+" : ""}
                {preview.rangeChange}
              </span>
            </div>
          </div>

          {/* 샘플 조정 내역 */}
          {preview.sampleAdjustments.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
              <p className="text-xs font-medium text-gray-700">샘플 조정 내역:</p>
              <div className="flex flex-col gap-1 text-xs text-gray-600">
                {preview.sampleAdjustments.map((sample, index) => (
                  <div key={index} className="flex justify-between">
                    <span>콘텐츠 {index + 1}:</span>
                    <span>
                      {sample.before.start}~{sample.before.end} →{" "}
                      {sample.after.start}~{sample.after.end}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={!preview}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
        >
          일괄 적용
        </button>
      </div>
    </div>
  );
}

