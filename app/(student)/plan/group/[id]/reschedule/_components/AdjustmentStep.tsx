/**
 * Step 2: 상세 조정 컴포넌트
 * 
 * 선택된 콘텐츠의 범위를 수정하거나 콘텐츠를 교체합니다.
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { PlanContent } from "@/lib/types/plan";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";
import { BatchAdjustmentPanel } from "./BatchAdjustmentPanel";
import { ContentReplaceModal } from "./ContentReplaceModal";
import { DateRangeSelector } from "./DateRangeSelector";
import { getTodayDateString } from "@/lib/reschedule/periodCalculator";

type DateRange = {
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
};

type AdjustmentStepProps = {
  contents: PlanContent[];
  selectedContentIds: Set<string>;
  adjustments: AdjustmentInput[];
  onComplete: (adjustments: AdjustmentInput[], placementDateRange: DateRange | null) => void;
  onBack: () => void;
  studentId: string;
  groupPeriodEnd: string; // YYYY-MM-DD
  existingPlans?: Array<{
    id: string;
    plan_date: string; // YYYY-MM-DD
    status: string | null;
    is_active: boolean | null;
  }>;
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
}: AdjustmentStepProps) {
  const toast = useToast();
  const today = getTodayDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
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
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [replacingContentId, setReplacingContentId] = useState<string | null>(null);
  const [replaceRange, setReplaceRange] = useState<{ start: number; end: number } | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Map<string, string>
  >(new Map());
  const [rangeInputs, setRangeInputs] = useState<
    Map<string, { start: string; end: string }>
  >(new Map());
  
  // 배치 범위 선택 관련 state
  const [placementMode, setPlacementMode] = useState<"auto" | "manual">("auto");
  const [placementDateRange, setPlacementDateRange] = useState<DateRange>({
    from: tomorrowStr,
    to: groupPeriodEnd,
  });
  const [placementRangeExpanded, setPlacementRangeExpanded] = useState(false);

  const selectedContents = useMemo(() => {
    return contents.filter(
      (c) => selectedContentIds.has(c.id || c.content_id)
    );
  }, [contents, selectedContentIds]);

  // 문자열 상태 초기화
  useEffect(() => {
    const newMap = new Map();
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
    const newValue = Math.max(0, value); // 음수 방지
    afterRange[field] = newValue;

    // 검증: 시작 <= 끝
    if (field === "start" && newValue > afterRange.end) {
      const errorMsg = "시작 범위는 끝 범위보다 작거나 같아야 합니다.";
      setValidationErrors(new Map(validationErrors.set(contentId, errorMsg)));
      toast.showError(errorMsg);
      return;
    }
    if (field === "end" && newValue < afterRange.start) {
      const errorMsg = "끝 범위는 시작 범위보다 크거나 같아야 합니다.";
      setValidationErrors(new Map(validationErrors.set(contentId, errorMsg)));
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

    setLocalAdjustments(new Map(localAdjustments.set(contentId, adjustment)));
  };

  // 범위 입력 핸들러 (문자열 처리)
  const handleRangeInputChange = (
    contentId: string,
    field: "start" | "end",
    value: string
  ) => {
    const newMap = new Map(rangeInputs);
    const current = newMap.get(contentId) || { start: "", end: "" };
    newMap.set(contentId, { ...current, [field]: value });
    setRangeInputs(newMap);
  };

  // 범위 blur 핸들러 (숫자 변환 및 검증)
  const handleRangeBlur = (
    contentId: string,
    field: "start" | "end"
  ) => {
    const inputValue = rangeInputs.get(contentId)?.[field] ?? "";
    const trimmedValue = inputValue.trim();

    if (trimmedValue === "") {
      // 빈 값이면 기본값으로 복원
      const content = contents.find((c) => (c.id || c.content_id) === contentId);
      if (content) {
        const adjustment = localAdjustments.get(contentId);
        const defaultValue = adjustment?.after.range?.[field] ??
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
  };

  // 교체된 콘텐츠 범위 입력 핸들러
  const handleReplacedRangeInputChange = (
    contentId: string,
    field: "start" | "end",
    value: string
  ) => {
    // 문자열 상태 업데이트
    const newMap = new Map(rangeInputs);
    const current = newMap.get(contentId) || { start: "", end: "" };
    newMap.set(contentId, { ...current, [field]: value });
    setRangeInputs(newMap);

    // 숫자로 변환하여 범위 업데이트 (빈 값이 아닐 때만)
    if (value.trim() !== "") {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 0) {
        const content = contents.find((c) => (c.id || c.content_id) === contentId);
        const existing = localAdjustments.get(contentId);
        const currentRange = existing?.after.range || (content ? {
          start: content.start_range,
          end: content.end_range,
        } : { start: 0, end: 0 });
        const newRange = {
          ...currentRange,
          [field]: numValue,
        };

        // replaceRange 및 localAdjustments 업데이트
        if (replacingContentId === contentId) {
          setReplaceRange(newRange);
        }
        if (existing && existing.change_type === "replace") {
          const updated: AdjustmentInput = {
            ...existing,
            after: {
              ...existing.after,
              range: newRange,
            },
          };
          setLocalAdjustments(
            new Map(localAdjustments.set(contentId, updated))
          );
        }
      }
    }
  };

  // 교체된 콘텐츠 범위 blur 핸들러
  const handleReplacedRangeBlur = (
    contentId: string,
    field: "start" | "end"
  ) => {
    const inputValue = rangeInputs.get(contentId)?.[field] ?? "";
    const trimmedValue = inputValue.trim();

    if (trimmedValue === "") {
      // 빈 값이면 현재 범위 값으로 복원
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
  };

  const handleReplaceClick = (contentId: string) => {
    setReplacingContentId(contentId);
    const content = contents.find((c) => (c.id || c.content_id) === contentId);
    if (content) {
      // 기존 범위를 기본값으로 설정
      const adjustment = localAdjustments.get(contentId);
      const currentRange = adjustment?.after.range || {
        start: content.start_range,
        end: content.end_range,
      };
      setReplaceRange(currentRange);
      // rangeInputs도 함께 초기화
      const newMap = new Map(rangeInputs);
      newMap.set(contentId, {
        start: String(currentRange.start),
        end: String(currentRange.end),
      });
      setRangeInputs(newMap);
    }
    setReplaceModalOpen(true);
  };

  const [replacedContentInfo, setReplacedContentInfo] = useState<
    Map<string, { title: string; total_page_or_time: number | null }>
  >(new Map());

  const handleReplace = (
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
    const content = contents.find((c) => (c.id || c.content_id) === contentId);
    if (!content) return;

    // 범위 검증
    if (newContent.total_page_or_time !== null) {
      if (range.start < 1 || range.end > newContent.total_page_or_time || range.start > range.end) {
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
      range: {
        start: content.start_range,
        end: content.end_range,
      },
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

    setLocalAdjustments(new Map(localAdjustments.set(contentId, adjustment)));
    setReplacedContentInfo(
      new Map(
        replacedContentInfo.set(contentId, {
          title: newContent.title,
          total_page_or_time: newContent.total_page_or_time,
        })
      )
    );
    // rangeInputs도 함께 업데이트
    const newMap = new Map(rangeInputs);
    newMap.set(contentId, {
      start: String(range.start),
      end: String(range.end),
    });
    setRangeInputs(newMap);
    setReplaceModalOpen(false);
    setReplacingContentId(null);
    setReplaceRange(null);
  };

  const handleReplaceCancel = () => {
    setReplaceModalOpen(false);
    setReplacingContentId(null);
    setReplaceRange(null);
  };

  const handleNext = () => {
    const adjustmentsArray = Array.from(localAdjustments.values());
    
    // 배치 범위 결정
    let finalPlacementRange: DateRange | null = null;
    if (placementMode === "auto") {
      // 자동 모드: 오늘 이후 ~ 플랜 그룹 종료일
      finalPlacementRange = {
        from: tomorrowStr,
        to: groupPeriodEnd,
      };
    } else {
      // 수동 모드: 사용자가 선택한 범위
      if (placementDateRange.from && placementDateRange.to) {
        finalPlacementRange = placementDateRange;
      } else {
        alert("배치 범위를 선택해주세요.");
        return;
      }
    }
    
    onComplete(adjustmentsArray, finalPlacementRange);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">상세 조정</h2>
        <p className="mt-1 text-sm text-gray-600">
          선택한 콘텐츠의 범위를 수정하거나 콘텐츠를 교체할 수 있습니다.
        </p>
      </div>

      {/* 일괄 조정 모드 안내 배너 */}
      {selectedContents.length > 1 && !batchMode && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">💡</span>
                <h3 className="font-medium text-blue-900">
                  일괄 조정 모드를 사용하시겠습니까?
                </h3>
              </div>
              <p className="mt-1 text-sm text-blue-700">
                {selectedContents.length}개의 콘텐츠를 선택하셨습니다. 일괄 조정 모드를 사용하면
                모든 콘텐츠를 한 번에 조정할 수 있습니다.
              </p>
              <div className="mt-2 text-xs text-blue-600">
                예시: 모든 콘텐츠의 범위를 10% 증가시키거나, 모든 콘텐츠에 +5페이지 추가
              </div>
            </div>
            <button
              onClick={() => setBatchMode(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              일괄 조정 시작
            </button>
          </div>
        </div>
      )}

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
          const isReplaced = adjustment?.change_type === "replace";
          const currentRange = adjustment?.after.range || {
            start: content.start_range,
            end: content.end_range,
          };

          // 교체된 콘텐츠 정보
          const replacedContent = isReplaced
            ? {
                content_id: adjustment.after.content_id,
                content_type: adjustment.after.content_type,
                info: replacedContentInfo.get(contentId),
              }
            : null;

          return (
            <div
              key={contentId}
              className={`rounded-lg border p-4 ${
                isReplaced
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">
                    {content.content_type === "book"
                      ? "📚 교재"
                      : content.content_type === "lecture"
                      ? "🎥 강의"
                      : "📝 커스텀"}
                  </h3>
                  {isReplaced && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      교체됨
                    </span>
                  )}
                </div>
                {isReplaced && replacedContent ? (
                  <div className="mt-1 flex flex-col gap-2 text-sm">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                      <div className="text-xs text-gray-500">교체 전</div>
                      <div className="mt-1 text-gray-700">
                        {content.content_type === "book"
                          ? "📚 교재"
                          : content.content_type === "lecture"
                          ? "🎥 강의"
                          : "📝 커스텀"}{" "}
                        {content.start_range} ~ {content.end_range}
                      </div>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                      <div className="text-xs text-blue-700">교체 후</div>
                      <div className="mt-1 font-medium text-blue-900">
                        {replacedContent.content_type === "book"
                          ? "📚 교재"
                          : replacedContent.content_type === "lecture"
                          ? "🎥 강의"
                          : "📝 커스텀"}
                        {replacedContent.info?.title && (
                          <span className="ml-2">{replacedContent.info.title}</span>
                        )}
                      </div>
                      <div className="mt-1 text-blue-700">
                        범위: {currentRange.start} ~ {currentRange.end}
                        {replacedContent.info?.total_page_or_time !== null && replacedContent.info?.total_page_or_time !== undefined && (
                          <span className="ml-2 text-xs text-blue-600">
                            (총{" "}
                            {replacedContent.content_type === "book"
                              ? `${replacedContent.info.total_page_or_time}페이지`
                              : replacedContent.content_type === "lecture"
                              ? `${replacedContent.info.total_page_or_time}분`
                              : `${replacedContent.info.total_page_or_time}`}
                            )
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-gray-600">
                    {content.start_range} ~ {content.end_range}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {!isReplaced && (
                  <>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-gray-700">
                          시작 범위:
                        </label>
                      <input
                        type="number"
                        value={rangeInputs.get(contentId)?.start ?? String(currentRange.start)}
                        onChange={(e) =>
                          handleRangeInputChange(contentId, "start", e.target.value)
                        }
                        onBlur={() => handleRangeBlur(contentId, "start")}
                        className={`rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 ${
                          validationErrors.has(contentId)
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        }`}
                        min={1}
                        aria-label="시작 범위 입력"
                        aria-invalid={validationErrors.has(contentId)}
                        aria-describedby={validationErrors.has(contentId) ? `error-${contentId}` : undefined}
                      />
                        <span className="text-xs text-gray-500">
                          {content.content_type === "book"
                            ? "페이지"
                            : content.content_type === "lecture"
                            ? "회차"
                            : ""}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-gray-700">
                          끝 범위:
                        </label>
                      <input
                        type="number"
                        value={rangeInputs.get(contentId)?.end ?? String(currentRange.end)}
                        onChange={(e) =>
                          handleRangeInputChange(contentId, "end", e.target.value)
                        }
                        onBlur={() => handleRangeBlur(contentId, "end")}
                        className={`rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 ${
                          validationErrors.has(contentId)
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        }`}
                        min={currentRange.start}
                        aria-label="끝 범위 입력"
                        aria-invalid={validationErrors.has(contentId)}
                        aria-describedby={validationErrors.has(contentId) ? `error-${contentId}` : undefined}
                      />
                        <span className="text-xs text-gray-500">
                          {content.content_type === "book"
                            ? "페이지"
                            : content.content_type === "lecture"
                            ? "회차"
                            : ""}
                        </span>
                      </div>

                      {/* 범위 미리보기 */}
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
                        범위: {currentRange.start} ~ {currentRange.end} (
                        {currentRange.end - currentRange.start + 1}
                        {content.content_type === "book"
                          ? "페이지"
                          : content.content_type === "lecture"
                          ? "회차"
                          : ""}
                        )
                      </div>

                      {/* 검증 오류 메시지 */}
                      {validationErrors.has(contentId) && (
                        <div 
                          id={`error-${contentId}`}
                          className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700"
                          role="alert"
                          aria-live="polite"
                        >
                          ⚠️ {validationErrors.get(contentId)}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {isReplaced && (
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">
                      시작 범위:
                    </label>
                    <input
                      type="number"
                      value={rangeInputs.get(contentId)?.start ?? String(currentRange.start)}
                      onChange={(e) =>
                        handleReplacedRangeInputChange(contentId, "start", e.target.value)
                      }
                      onBlur={() => handleReplacedRangeBlur(contentId, "start")}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      min={1}
                    />
                  </div>
                )}

                {isReplaced && (
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">
                      끝 범위:
                    </label>
                    <input
                      type="number"
                      value={rangeInputs.get(contentId)?.end ?? String(currentRange.end)}
                      onChange={(e) =>
                        handleReplacedRangeInputChange(contentId, "end", e.target.value)
                      }
                      onBlur={() => handleReplacedRangeBlur(contentId, "end")}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      min={currentRange.start}
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleReplaceClick(contentId)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    {isReplaced ? "다시 교체" : "콘텐츠 교체"}
                  </button>
                  {isReplaced && (
                    <button
                      onClick={() => {
                        // 교체 취소
                        const newMap = new Map(localAdjustments);
                        newMap.delete(contentId);
                        setLocalAdjustments(newMap);
                        const newInfoMap = new Map(replacedContentInfo);
                        newInfoMap.delete(contentId);
                        setReplacedContentInfo(newInfoMap);
                      }}
                      className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                    >
                      교체 취소
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 재조정 플랜 배치 범위 선택 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          재조정 플랜 배치 범위 선택
        </h3>
        <p className="mb-3 text-xs text-gray-600">
          새로 생성된 플랜을 어떤 날짜 범위에 배치할지 선택합니다 (오늘 이후만 가능)
        </p>
        <div className="flex flex-col gap-3">
          <label
            className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition hover:bg-gray-50"
            aria-label="자동 배치 모드 선택"
          >
            <input
              type="radio"
              name="placementMode"
              value="auto"
              checked={placementMode === "auto"}
              onChange={() => {
                setPlacementMode("auto");
                setPlacementRangeExpanded(false);
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              aria-label="자동 배치"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">자동</div>
              <div className="text-xs text-gray-600">
                오늘 이후 ~ 플랜 그룹 종료일 ({tomorrowStr} ~ {groupPeriodEnd})
              </div>
            </div>
          </label>
          <label
            className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition hover:bg-gray-50"
            aria-label="수동 선택 모드 선택"
          >
            <input
              type="radio"
              name="placementMode"
              value="manual"
              checked={placementMode === "manual"}
              onChange={() => {
                setPlacementMode("manual");
                setPlacementRangeExpanded(true);
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              aria-label="수동 선택"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">수동 선택</div>
              <div className="text-xs text-gray-600">
                원하는 날짜 범위를 직접 선택합니다 (오늘 이후만 선택 가능)
              </div>
            </div>
          </label>
        </div>

        {/* 배치 범위 선택 UI (접이식 패널) */}
        {placementMode === "manual" && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setPlacementRangeExpanded(!placementRangeExpanded)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-gray-50 p-3 transition hover:bg-gray-100"
              aria-expanded={placementRangeExpanded}
              aria-controls="placement-range-panel"
            >
              <span className="text-sm font-medium text-gray-900">
                배치 범위 선택
              </span>
              {placementRangeExpanded ? (
                <ChevronUp
                  className="h-5 w-5 text-gray-600"
                  aria-hidden="true"
                />
              ) : (
                <ChevronDown
                  className="h-5 w-5 text-gray-600"
                  aria-hidden="true"
                />
              )}
            </button>

            {placementRangeExpanded && (
              <div
                id="placement-range-panel"
                className="mt-4 flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4"
                role="region"
                aria-label="배치 범위 선택 패널"
              >
                {/* 날짜 범위 선택 캘린더 */}
                <DateRangeSelector
                  groupPeriodStart={tomorrowStr}
                  groupPeriodEnd={groupPeriodEnd}
                  existingPlans={existingPlans}
                  onRangeChange={setPlacementDateRange}
                  initialRange={placementDateRange}
                  minDate={tomorrowStr}
                />
              </div>
            )}
          </div>
        )}

        {/* 선택한 배치 범위 요약 */}
        {placementMode === "auto" ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-sm font-medium text-blue-900">
              자동 배치 범위
            </div>
            <div className="mt-1 text-sm text-blue-700">
              {tomorrowStr} ~ {groupPeriodEnd}
            </div>
          </div>
        ) : (
          placementDateRange.from &&
          placementDateRange.to && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="text-sm font-medium text-blue-900">
                선택한 배치 범위
              </div>
              <div className="mt-1 text-sm text-blue-700">
                {placementDateRange.from} ~ {placementDateRange.to}
              </div>
            </div>
          )
        )}
      </div>

      {/* 변경 사항 요약 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          변경 사항 요약
        </h3>
        {localAdjustments.size === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-600">
            변경 사항이 없습니다. 범위를 수정하거나 콘텐츠를 교체해주세요.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs text-gray-600">범위 수정</div>
                <div className="mt-1 text-lg font-bold text-gray-900">
                  {
                    Array.from(localAdjustments.values()).filter(
                      (adj) => adj.change_type === "range"
                    ).length
                  }
                  개
                </div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="text-xs text-blue-700">콘텐츠 교체</div>
                <div className="mt-1 text-lg font-bold text-blue-600">
                  {
                    Array.from(localAdjustments.values()).filter(
                      (adj) => adj.change_type === "replace"
                    ).length
                  }
                  개
                </div>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="text-xs text-green-700">전체 재생성</div>
                <div className="mt-1 text-lg font-bold text-green-600">
                  {
                    Array.from(localAdjustments.values()).filter(
                      (adj) => adj.change_type === "full"
                    ).length
                  }
                  개
                </div>
              </div>
            </div>

            {/* 변경 내역 상세 (접이식) */}
            <details className="rounded-lg border border-gray-200 bg-gray-50">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                변경 내역 상세 보기 ({localAdjustments.size}개)
              </summary>
              <div className="border-t border-gray-200 p-3">
                <div className="flex flex-col gap-2 text-xs">
                  {Array.from(localAdjustments.values()).map((adj, index) => {
                    const content = contents.find(
                      (c) => (c.id || c.content_id) === adj.plan_content_id
                    );
                    const contentName =
                      content?.content_type === "book"
                        ? "📚 교재"
                        : content?.content_type === "lecture"
                        ? "🎥 강의"
                        : "📝 커스텀";

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {contentName}
                          </span>
                          <span className="text-gray-600">
                            {adj.change_type === "range"
                              ? "범위 수정"
                              : adj.change_type === "replace"
                              ? "콘텐츠 교체"
                              : "전체 재생성"}
                          </span>
                        </div>
                        <div className="text-gray-600">
                          {adj.before.range.start}~{adj.before.range.end} →{" "}
                          {adj.after.range.start}~{adj.after.range.end}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          </div>
        )}
      </div>

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
            contents.find((c) => (c.id || c.content_id) === replacingContentId)
              ?.content_type
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

