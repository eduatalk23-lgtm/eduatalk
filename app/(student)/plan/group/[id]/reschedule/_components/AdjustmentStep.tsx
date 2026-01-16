/**
 * Step 2: 상세 조정 컴포넌트
 *
 * 선택된 콘텐츠의 범위를 수정하거나 콘텐츠를 교체합니다.
 */

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import type { PlanContent } from "@/lib/types/plan";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";
import { BatchAdjustmentPanel } from "./BatchAdjustmentPanel";
import { ContentReplaceModal } from "./ContentReplaceModal";
import { getTodayDateString } from "@/lib/reschedule/periodCalculator";
import {
  BatchModeBanner,
  BatchModeToggle,
  PlacementRangeSection,
  AdjustmentSummary,
  ContentAdjustmentCard,
  type DateRange,
  type RangeInputs,
  type ReplacedContentInfo,
} from "./adjustment";

type AdjustmentStepProps = {
  contents: PlanContent[];
  selectedContentIds: Set<string>;
  adjustments: AdjustmentInput[];
  onComplete: (
    adjustments: AdjustmentInput[],
    placementDateRange: DateRange | null
  ) => void;
  onBack: () => void;
  studentId: string;
  groupPeriodEnd: string; // YYYY-MM-DD
  existingPlans?: Array<{
    id: string;
    plan_date: string; // YYYY-MM-DD
    status: string | null;
    is_active: boolean | null;
  }>;
  onAutoFill?: (range: {
    from: string;
    to: string;
  }) => Promise<AdjustmentInput[] | undefined>;
  isGenerating?: boolean;
};

export function AdjustmentStep({
  contents,
  selectedContentIds,
  adjustments: initialAdjustments,
  onComplete,
  onBack,
  studentId,
  groupPeriodEnd,
  existingPlans = [],
  onAutoFill,
  isGenerating = false,
}: AdjustmentStepProps) {
  const toast = useToast();
  // ... (keep existing state setup)
  const today = getTodayDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const [localAdjustments, setLocalAdjustments] = useState<
    Map<string, AdjustmentInput>
  >(() => {
    const map = new Map();
    initialAdjustments.forEach((adj) => {
      map.set(adj.plan_content_id, adj);
    });
    return map;
  });
  
  // ... (keep existing state)
  const [batchMode, setBatchMode] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replacingContentId, setReplacingContentId] = useState<string | null>(
    null
  );
  const [replaceRange, setReplaceRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(
    new Map()
  );
  const [rangeInputs, setRangeInputs] = useState<RangeInputs>(new Map());

  // 배치 범위 선택 관련 state
  const [placementMode, setPlacementMode] = useState<"auto" | "manual">("auto");
  const [placementDateRange, setPlacementDateRange] = useState<DateRange>({
    from: tomorrowStr,
    to: groupPeriodEnd,
  });
  const [replacedContentInfo, setReplacedContentInfo] =
    useState<ReplacedContentInfo>(new Map());

  const selectedContents = useMemo(() => {
    return contents.filter((c) =>
      selectedContentIds.has(c.id || c.content_id)
    );
  }, [contents, selectedContentIds]);

  // 문자열 상태 초기화
  useEffect(() => {
    const newMap = new Map<string, { start: string; end: string }>();
    selectedContents.forEach((content) => {
      const contentId = content.id || content.content_id;
      const adjustment = localAdjustments.get(contentId);
      const currentRange = adjustment?.after.range || {
        start: content.start_range,
        end: content.end_range,
      };
      newMap.set(contentId, {
        start: String(currentRange.start),
        end: String(currentRange.end),
      });
    });
    setRangeInputs(newMap);
  }, [selectedContents, localAdjustments]);

  // Handle Auto Fill Click
  const handleAutoFillClick = async () => {
    if (!onAutoFill) return;
    
    try {
      const result = await onAutoFill({ from: tomorrowStr, to: groupPeriodEnd });
      if (result && result.length > 0) {
        const newMap = new Map(localAdjustments);
        result.forEach(adj => {
             newMap.set(adj.plan_content_id, adj);
        });
        setLocalAdjustments(newMap);
        
        // Update range inputs visually
        const newRangeInputs = new Map(rangeInputs);
        result.forEach(adj => {
             const range = adj.after.range;
             newRangeInputs.set(adj.plan_content_id, {
                 start: String(range.start),
                 end: String(range.end)
             });
        });
        setRangeInputs(newRangeInputs);
      }
    } catch (error) {
      console.error(error);
      // Toast already shown in parent via catch
    }
  };

  // ... (handleRangeChange removed, as it exists below)
  
  // ... (keep other handlers: handleRangeInputChange, handleRangeBlur, etc. UNCHANGED - I will simplify replacement to avoid re-writing them all if possible, but replace_file_content needs contiguous block. Use start/end lines carefully)
  
  // Actually, I can replace the PROP definitions and the BUTTON separately using multi_replace_file_content or careful block selection.
  // But wait, the previous tool showed me lines 1-100 and it ended with `selectedContents`.
  // The button is way down in the return statement.
  
  // I'll make TWO replacement chunks.
  // 1. Props (lines 45-60)
  // 2. Button onClick (lines ~430)
  
  // Wait, I need to define `handleAutoFillClick` inside the component body too.
  
  // I will use `replace_file_content` for the Props and Component Start, including `handleAutoFillClick`.
  // And `replace_file_content` for the Button.
  // Wait, I can't use `replace_file_content` twice in one turn on same file?
  // Docs say: "Do NOT make multiple parallel calls... for the same file."
  // Use `multi_replace_file_content`!



  const handleRangeChange = useCallback(
    (contentId: string, field: "start" | "end", value: number) => {
      const content = contents.find(
        (c) => (c.id || c.content_id) === contentId
      );
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
      const newValue = Math.max(0, value);
      afterRange[field] = newValue;

      // 검증: 시작 <= 끝
      if (field === "start" && newValue > afterRange.end) {
        const errorMsg = "시작 범위는 끝 범위보다 작거나 같아야 합니다.";
        setValidationErrors(
          new Map(validationErrors.set(contentId, errorMsg))
        );
        toast.showError(errorMsg);
        return;
      }
      if (field === "end" && newValue < afterRange.start) {
        const errorMsg = "끝 범위는 시작 범위보다 크거나 같아야 합니다.";
        setValidationErrors(
          new Map(validationErrors.set(contentId, errorMsg))
        );
        toast.showError(errorMsg);
        return;
      }

      // 검증 통과 시 에러 제거
      const newErrors = new Map(validationErrors);
      newErrors.delete(contentId);
      setValidationErrors(newErrors);

      const adjustment: AdjustmentInput = {
        plan_content_id: contentId,
        change_type: "range",
        before,
        after: {
          ...before,
          range: afterRange,
        },
      };

      setLocalAdjustments(
        new Map(localAdjustments.set(contentId, adjustment))
      );
    },
    [contents, localAdjustments, validationErrors, toast]
  );

  const handleRangeInputChange = useCallback(
    (contentId: string, field: "start" | "end", value: string) => {
      const newMap = new Map(rangeInputs);
      const current = newMap.get(contentId) || { start: "", end: "" };
      newMap.set(contentId, { ...current, [field]: value });
      setRangeInputs(newMap);
    },
    [rangeInputs]
  );

  const handleRangeBlur = useCallback(
    (contentId: string, field: "start" | "end") => {
      const inputValue = rangeInputs.get(contentId)?.[field] ?? "";
      const trimmedValue = inputValue.trim();

      if (trimmedValue === "") {
        const content = contents.find(
          (c) => (c.id || c.content_id) === contentId
        );
        if (content) {
          const adjustment = localAdjustments.get(contentId);
          const defaultValue =
            adjustment?.after.range?.[field] ??
            (field === "start" ? content.start_range : content.end_range);

          const newMap = new Map(rangeInputs);
          const current = newMap.get(contentId) || { start: "", end: "" };
          newMap.set(contentId, { ...current, [field]: String(defaultValue) });
          setRangeInputs(newMap);

          handleRangeChange(contentId, field, defaultValue);
        }
        return;
      }

      const numValue = parseInt(trimmedValue, 10);
      if (!isNaN(numValue) && numValue >= 0) {
        handleRangeChange(contentId, field, numValue);
      }
    },
    [contents, localAdjustments, rangeInputs, handleRangeChange]
  );

  const handleReplacedRangeInputChange = useCallback(
    (contentId: string, field: "start" | "end", value: string) => {
      const newMap = new Map(rangeInputs);
      const current = newMap.get(contentId) || { start: "", end: "" };
      newMap.set(contentId, { ...current, [field]: value });
      setRangeInputs(newMap);

      if (value.trim() !== "") {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue >= 0) {
          const content = contents.find(
            (c) => (c.id || c.content_id) === contentId
          );
          const existing = localAdjustments.get(contentId);
          const currentRange = existing?.after.range ||
            (content
              ? { start: content.start_range, end: content.end_range }
              : { start: 0, end: 0 });
          const newRange = { ...currentRange, [field]: numValue };

          if (replacingContentId === contentId) {
            setReplaceRange(newRange);
          }
          if (existing && existing.change_type === "replace") {
            const updated: AdjustmentInput = {
              ...existing,
              after: { ...existing.after, range: newRange },
            };
            setLocalAdjustments(
              new Map(localAdjustments.set(contentId, updated))
            );
          }
        }
      }
    },
    [contents, localAdjustments, rangeInputs, replacingContentId]
  );

  const handleReplacedRangeBlur = useCallback(
    (contentId: string, field: "start" | "end") => {
      const inputValue = rangeInputs.get(contentId)?.[field] ?? "";
      const trimmedValue = inputValue.trim();

      if (trimmedValue === "") {
        const existing = localAdjustments.get(contentId);
        if (existing && existing.change_type === "replace") {
          const currentRange = existing.after.range;
          const defaultValue = currentRange[field];

          const newMap = new Map(rangeInputs);
          const current = newMap.get(contentId) || { start: "", end: "" };
          newMap.set(contentId, { ...current, [field]: String(defaultValue) });
          setRangeInputs(newMap);
        }
      }
    },
    [localAdjustments, rangeInputs]
  );

  const handleReplaceClick = useCallback(
    (contentId: string) => {
      setReplacingContentId(contentId);
      const content = contents.find(
        (c) => (c.id || c.content_id) === contentId
      );
      if (content) {
        const adjustment = localAdjustments.get(contentId);
        const currentRange = adjustment?.after.range || {
          start: content.start_range,
          end: content.end_range,
        };
        setReplaceRange(currentRange);
        const newMap = new Map(rangeInputs);
        newMap.set(contentId, {
          start: String(currentRange.start),
          end: String(currentRange.end),
        });
        setRangeInputs(newMap);
      }
      setReplaceModalOpen(true);
    },
    [contents, localAdjustments, rangeInputs]
  );

  const handleCancelReplace = useCallback(
    (contentId: string) => {
      const newMap = new Map(localAdjustments);
      newMap.delete(contentId);
      setLocalAdjustments(newMap);
      const newInfoMap = new Map(replacedContentInfo);
      newInfoMap.delete(contentId);
      setReplacedContentInfo(newInfoMap);
    },
    [localAdjustments, replacedContentInfo]
  );

  const handleReplace = useCallback(
    (
      contentId: string,
      newContent: {
        content_id: string;
        content_type: "book" | "lecture" | "custom";
        title: string;
        total_page_or_time: number | null;
        range: { start: number; end: number };
      }
    ) => {
      const range = newContent.range;
      const content = contents.find(
        (c) => (c.id || c.content_id) === contentId
      );
      if (!content) return;

      if (newContent.total_page_or_time !== null) {
        if (
          range.start < 1 ||
          range.end > newContent.total_page_or_time ||
          range.start > range.end
        ) {
          alert(
            `범위가 유효하지 않습니다. (1 ~ ${newContent.total_page_or_time} 사이, 시작 <= 끝)`
          );
          return;
        }
      }

      const existing = localAdjustments.get(contentId);
      const before: AdjustmentInput["before"] = existing?.before || {
        content_id: content.content_id,
        content_type: content.content_type,
        range: { start: content.start_range, end: content.end_range },
      };

      const adjustment: AdjustmentInput = {
        plan_content_id: contentId,
        change_type: "replace",
        before,
        after: {
          content_id: newContent.content_id,
          content_type: newContent.content_type,
          range,
        },
      };

      setLocalAdjustments(
        new Map(localAdjustments.set(contentId, adjustment))
      );
      setReplacedContentInfo(
        new Map(
          replacedContentInfo.set(contentId, {
            title: newContent.title,
            total_page_or_time: newContent.total_page_or_time,
          })
        )
      );
      const newMap = new Map(rangeInputs);
      newMap.set(contentId, {
        start: String(range.start),
        end: String(range.end),
      });
      setRangeInputs(newMap);
      setReplaceModalOpen(false);
      setReplacingContentId(null);
      setReplaceRange(null);
    },
    [contents, localAdjustments, rangeInputs, replacedContentInfo]
  );

  const handleReplaceCancel = useCallback(() => {
    setReplaceModalOpen(false);
    setReplacingContentId(null);
    setReplaceRange(null);
  }, []);

  const handleBatchApply = useCallback(
    (adjustments: AdjustmentInput[]) => {
      const newMap = new Map(localAdjustments);
      adjustments.forEach((adj) => {
        newMap.set(adj.plan_content_id, adj);
      });
      setLocalAdjustments(newMap);
      setBatchMode(false);
    },
    [localAdjustments]
  );

  const handleNext = useCallback(() => {
    const adjustmentsArray = Array.from(localAdjustments.values());

    let finalPlacementRange: DateRange | null = null;
    if (placementMode === "auto") {
      finalPlacementRange = { from: tomorrowStr, to: groupPeriodEnd };
    } else {
      if (placementDateRange.from && placementDateRange.to) {
        finalPlacementRange = placementDateRange;
      } else {
        alert("배치 범위를 선택해주세요.");
        return;
      }
    }

    onComplete(adjustmentsArray, finalPlacementRange);
  }, [
    localAdjustments,
    placementMode,
    placementDateRange,
    tomorrowStr,
    groupPeriodEnd,
    onComplete,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-gray-900">상세 조정</h2>
          <p className="text-sm text-gray-600">
            선택한 콘텐츠의 범위를 수정하거나 콘텐츠를 교체할 수 있습니다.
          </p>
        </div>
        {onAutoFill && (
          <button
            onClick={handleAutoFillClick}
            disabled={isGenerating}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
              isGenerating
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isGenerating ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>AI 배정 중...</span>
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>AI 자동 채우기</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 일괄 조정 모드 안내 배너 */}
      {selectedContents.length > 1 && !batchMode && (
        <BatchModeBanner
          contentCount={selectedContents.length}
          onEnableBatchMode={() => setBatchMode(true)}
        />
      )}

      {/* 일괄 조정 모드 토글 */}
      {selectedContents.length > 1 && (
        <BatchModeToggle enabled={batchMode} onChange={setBatchMode} />
      )}

      {/* 일괄 조정 패널 */}
      {batchMode && selectedContents.length > 1 && (
        <BatchAdjustmentPanel
          contents={selectedContents}
          selectedContentIds={selectedContentIds}
          onApply={handleBatchApply}
          onCancel={() => setBatchMode(false)}
        />
      )}

      {/* 콘텐츠 목록 */}
      <div className="flex flex-col gap-4">
        {selectedContents.map((content) => {
          const contentId = content.id || content.content_id;
          const adjustment = localAdjustments.get(contentId);
          const currentRange = adjustment?.after.range || {
            start: content.start_range,
            end: content.end_range,
          };

          return (
            <ContentAdjustmentCard
              key={contentId}
              content={content}
              contentId={contentId}
              adjustment={adjustment}
              currentRange={currentRange}
              rangeInputs={rangeInputs}
              validationErrors={validationErrors}
              replacedContentInfo={replacedContentInfo}
              onRangeInputChange={handleRangeInputChange}
              onRangeBlur={handleRangeBlur}
              onReplacedRangeInputChange={handleReplacedRangeInputChange}
              onReplacedRangeBlur={handleReplacedRangeBlur}
              onReplaceClick={handleReplaceClick}
              onCancelReplace={handleCancelReplace}
            />
          );
        })}
      </div>

      {/* 재조정 플랜 배치 범위 선택 */}
      <PlacementRangeSection
        placementMode={placementMode}
        onPlacementModeChange={setPlacementMode}
        placementDateRange={placementDateRange}
        onPlacementDateRangeChange={setPlacementDateRange}
        tomorrowStr={tomorrowStr}
        groupPeriodEnd={groupPeriodEnd}
        existingPlans={existingPlans}
      />

      {/* 변경 사항 요약 */}
      <AdjustmentSummary
        adjustments={localAdjustments}
        contents={contents}
      />

      {/* 콘텐츠 교체 모달 */}
      {replaceModalOpen && replacingContentId && replaceRange && (
        <ContentReplaceModal
          isOpen={replaceModalOpen}
          onClose={handleReplaceCancel}
          onSelect={(newContent) => {
            handleReplace(replacingContentId, newContent);
          }}
          studentId={studentId}
          currentContentType={
            contents.find(
              (c) => (c.id || c.content_id) === replacingContentId
            )?.content_type
          }
          initialRange={replaceRange}
        />
      )}

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
