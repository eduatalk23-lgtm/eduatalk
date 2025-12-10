/**
 * Step 2: 상세 조정 컴포넌트
 * 
 * 선택된 콘텐츠의 범위를 수정하거나 콘텐츠를 교체합니다.
 */

"use client";

import { useState, useMemo } from "react";
import type { PlanContent } from "@/lib/types/plan";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";
import { BatchAdjustmentPanel } from "./BatchAdjustmentPanel";

type AdjustmentStepProps = {
  contents: PlanContent[];
  selectedContentIds: Set<string>;
  adjustments: AdjustmentInput[];
  onComplete: (adjustments: AdjustmentInput[]) => void;
  onBack: () => void;
};

export function AdjustmentStep({
  contents,
  selectedContentIds,
  adjustments: initialAdjustments,
  onComplete,
  onBack,
}: AdjustmentStepProps) {
  const [localAdjustments, setLocalAdjustments] = useState<
    Map<string, AdjustmentInput>
  >(() => {
    const map = new Map();
    initialAdjustments.forEach((adj) => {
      map.set(adj.plan_content_id, adj);
    });
    return map;
  });
  const [batchMode, setBatchMode] = useState(false);

  const selectedContents = useMemo(() => {
    return contents.filter(
      (c) => selectedContentIds.has(c.id || c.content_id)
    );
  }, [contents, selectedContentIds]);

  const handleRangeChange = (
    contentId: string,
    field: "start" | "end",
    value: number
  ) => {
    const content = contents.find((c) => (c.id || c.content_id) === contentId);
    if (!content) return;

    const existing = localAdjustments.get(contentId);
    const before: AdjustmentInput["before"] = existing?.before || {
      content_id: content.content_id,
      content_type: content.content_type,
      range: {
        start: content.start_range,
        end: content.end_range,
      },
    };

    const afterRange = existing?.after.range || { ...before.range };
    afterRange[field] = value;

    const adjustment: AdjustmentInput = {
      plan_content_id: contentId,
      change_type: "range",
      before,
      after: {
        ...before,
        range: afterRange,
      },
    };

    setLocalAdjustments(new Map(localAdjustments.set(contentId, adjustment)));
  };

  const handleReplace = (contentId: string, newContentId: string) => {
    const content = contents.find((c) => (c.id || c.content_id) === contentId);
    if (!content) return;

    const existing = localAdjustments.get(contentId);
    const before: AdjustmentInput["before"] = existing?.before || {
      content_id: content.content_id,
      content_type: content.content_type,
      range: {
        start: content.start_range,
        end: content.end_range,
      },
    };

    // TODO: 새 콘텐츠 정보 조회 필요
    const adjustment: AdjustmentInput = {
      plan_content_id: contentId,
      change_type: "replace",
      before,
      after: {
        content_id: newContentId,
        content_type: before.content_type, // TODO: 실제 타입 조회
        range: before.range,
      },
    };

    setLocalAdjustments(new Map(localAdjustments.set(contentId, adjustment)));
  };

  const handleNext = () => {
    const adjustmentsArray = Array.from(localAdjustments.values());
    onComplete(adjustmentsArray);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">상세 조정</h2>
        <p className="mt-1 text-sm text-gray-600">
          선택한 콘텐츠의 범위를 수정하거나 콘텐츠를 교체할 수 있습니다.
        </p>
      </div>

      {/* 일괄 조정 모드 토글 */}
      {selectedContents.length > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <h3 className="font-medium text-gray-900">일괄 조정 모드</h3>
            <p className="mt-1 text-xs text-gray-600">
              여러 콘텐츠를 한 번에 조정할 수 있습니다.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={batchMode}
              onChange={(e) => setBatchMode(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">일괄 조정 활성화</span>
          </label>
        </div>
      )}

      {/* 일괄 조정 패널 */}
      {batchMode && selectedContents.length > 1 && (
        <BatchAdjustmentPanel
          contents={selectedContents}
          selectedContentIds={selectedContentIds}
          onApply={(adjustments) => {
            const newMap = new Map(localAdjustments);
            adjustments.forEach((adj) => {
              newMap.set(adj.plan_content_id, adj);
            });
            setLocalAdjustments(newMap);
            setBatchMode(false);
          }}
          onCancel={() => setBatchMode(false)}
        />
      )}

      <div className="flex flex-col gap-4">
        {selectedContents.map((content) => {
          const contentId = content.id || content.content_id;
          const adjustment = localAdjustments.get(contentId);
          const currentRange = adjustment?.after.range || {
            start: content.start_range,
            end: content.end_range,
          };

          return (
            <div
              key={contentId}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="mb-3">
                <h3 className="font-medium text-gray-900">
                  {content.content_type === "book"
                    ? "📚 교재"
                    : content.content_type === "lecture"
                    ? "🎥 강의"
                    : "📝 커스텀"}
                </h3>
                <p className="text-sm text-gray-600">
                  {content.start_range} ~ {content.end_range}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">
                    시작 범위:
                  </label>
                  <input
                    type="number"
                    value={currentRange.start}
                    onChange={(e) =>
                      handleRangeChange(
                        contentId,
                        "start",
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    min={0}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">
                    끝 범위:
                  </label>
                  <input
                    type="number"
                    value={currentRange.end}
                    onChange={(e) =>
                      handleRangeChange(
                        contentId,
                        "end",
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    min={currentRange.start}
                  />
                </div>

                {/* TODO: 콘텐츠 교체 UI 추가 */}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          뒤로가기
        </button>
        <button
          onClick={handleNext}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          다음
        </button>
      </div>
    </div>
  );
}

