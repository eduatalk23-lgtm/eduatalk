"use client";

import React, { memo, useCallback, useState, useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  ContentSlot,
  convertSlotsToContents,
  validateSlotConfiguration,
  validateContentLinking,
  validateModeSwitch,
} from "@/lib/types/content-selection";
import { SlotConfigurationPanel } from "./SlotConfigurationPanel";
import { ContentLinkingPanel } from "./ContentLinkingPanel";
import { VirtualTimelinePreview } from "./VirtualTimelinePreview";
import { ToggleLeft, ToggleRight, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { SelectedContent } from "@/lib/types/content-selection";
import type { DailyScheduleInfo } from "@/lib/plan/virtualSchedulePreview";

// ============================================================================
// 타입 정의
// ============================================================================

type ContentItem = {
  id: string;
  title: string;
  subtitle?: string;
  content_type: "book" | "lecture" | "custom";
  subject_category?: string;
  subject?: string;
  total_pages?: number;
  total_episodes?: number;
  master_content_id?: string;
};

type Step3SlotModeSelectionProps = {
  // 데이터
  contentSlots: ContentSlot[];
  useSlotMode: boolean;
  studentContents: SelectedContent[];
  recommendedContents: SelectedContent[];

  // 콜백
  onContentSlotsChange: (slots: ContentSlot[]) => void;
  onUseSlotModeChange: (useSlotMode: boolean) => void;
  onStudentContentsChange: (contents: SelectedContent[]) => void;

  // 콘텐츠 목록
  availableContents: {
    books: ContentItem[];
    lectures: ContentItem[];
    custom: ContentItem[];
  };

  // 템플릿 슬롯 (캠프 모드에서 사용)
  templateSlots?: ContentSlot[];

  // 일별 스케줄 (가상 타임라인용)
  dailySchedules?: DailyScheduleInfo[];

  // 옵션
  editable?: boolean;
  isCampMode?: boolean;
  isTemplateMode?: boolean;
  studentId?: string;
  showTimelinePreview?: boolean;
  className?: string;
};

// ============================================================================
// 컴포넌트
// ============================================================================

function Step3SlotModeSelectionComponent({
  contentSlots,
  useSlotMode,
  studentContents,
  recommendedContents,
  onContentSlotsChange,
  onUseSlotModeChange,
  onStudentContentsChange,
  availableContents,
  templateSlots,
  dailySchedules = [],
  editable = true,
  isCampMode = false,
  isTemplateMode = false,
  studentId,
  showTimelinePreview = true,
  className,
}: Step3SlotModeSelectionProps) {
  // 선택된 슬롯 인덱스
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null
  );

  // 모드 전환 경고 표시
  const [showModeWarning, setShowModeWarning] = useState(false);

  // 타임라인 미리보기 접기/펼치기
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(true);

  // 선택된 슬롯
  const selectedSlot = useMemo(() => {
    if (selectedSlotIndex === null) return null;
    return contentSlots[selectedSlotIndex] || null;
  }, [contentSlots, selectedSlotIndex]);

  // 검증 결과
  const slotValidation = useMemo(
    () => validateSlotConfiguration(contentSlots),
    [contentSlots]
  );
  const linkingValidation = useMemo(
    () => validateContentLinking(contentSlots),
    [contentSlots]
  );

  // 모드 전환 핸들러
  const handleModeToggle = useCallback(() => {
    const currentMode = useSlotMode ? "slot" : "legacy";
    const targetMode = useSlotMode ? "legacy" : "slot";
    const hasData = contentSlots.length > 0;

    const validation = validateModeSwitch(currentMode, targetMode, hasData);

    if (validation.warning) {
      setShowModeWarning(true);
      // 3초 후 경고 숨기기
      setTimeout(() => setShowModeWarning(false), 3000);
    }

    // 모드 전환
    onUseSlotModeChange(!useSlotMode);

    // 레거시 모드로 전환 시 Dual Write 적용
    if (useSlotMode && contentSlots.length > 0) {
      const convertedContents = convertSlotsToContents(contentSlots);
      onStudentContentsChange([...studentContents, ...convertedContents]);
    }
  }, [
    useSlotMode,
    contentSlots,
    studentContents,
    onUseSlotModeChange,
    onStudentContentsChange,
  ]);

  // 콘텐츠 연결 핸들러
  const handleLinkContent = useCallback(
    (
      slotIndex: number,
      content: ContentItem,
      range: { start: number; end: number }
    ) => {
      const updatedSlots = [...contentSlots];
      updatedSlots[slotIndex] = {
        ...updatedSlots[slotIndex],
        content_id: content.id,
        title: content.title,
        start_range: range.start,
        end_range: range.end,
        master_content_id: content.master_content_id,
      };
      onContentSlotsChange(updatedSlots);

      // Dual Write: 레거시 형식으로도 저장
      const convertedContents = convertSlotsToContents(updatedSlots);
      onStudentContentsChange(convertedContents);
    },
    [contentSlots, onContentSlotsChange, onStudentContentsChange]
  );

  // 콘텐츠 연결 해제 핸들러
  const handleUnlinkContent = useCallback(
    (slotIndex: number) => {
      const updatedSlots = [...contentSlots];
      updatedSlots[slotIndex] = {
        ...updatedSlots[slotIndex],
        content_id: undefined,
        title: undefined,
        start_range: undefined,
        end_range: undefined,
        start_detail_id: undefined,
        end_detail_id: undefined,
        master_content_id: undefined,
      };
      onContentSlotsChange(updatedSlots);

      // Dual Write: 레거시 형식으로도 저장
      const convertedContents = convertSlotsToContents(updatedSlots);
      onStudentContentsChange(convertedContents);
    },
    [contentSlots, onContentSlotsChange, onStudentContentsChange]
  );

  // 슬롯 변경 핸들러 (Dual Write 적용)
  const handleSlotsChange = useCallback(
    (slots: ContentSlot[]) => {
      onContentSlotsChange(slots);

      // Dual Write: 레거시 형식으로도 저장
      const convertedContents = convertSlotsToContents(slots);
      onStudentContentsChange(convertedContents);
    },
    [onContentSlotsChange, onStudentContentsChange]
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* 모드 전환 토글 (일반 모드에서만 표시) */}
      {!isCampMode && !isTemplateMode && editable && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div>
            <div className="text-sm font-medium text-gray-700">
              콘텐츠 선택 방식
            </div>
            <div className="text-xs text-gray-500">
              {useSlotMode
                ? "슬롯 방식: 교과-과목별로 계획적으로 구성"
                : "기존 방식: 직접 콘텐츠 선택"}
            </div>
          </div>
          <button
            type="button"
            onClick={handleModeToggle}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-gray-100"
          >
            {useSlotMode ? (
              <>
                <ToggleRight className="h-5 w-5 text-blue-600" />
                <span>슬롯 모드</span>
              </>
            ) : (
              <>
                <ToggleLeft className="h-5 w-5 text-gray-400" />
                <span>기존 모드</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 모드 전환 경고 */}
      {showModeWarning && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            모드 전환 시 일부 정보가 손실될 수 있습니다. 데이터가 자동으로
            변환됩니다.
          </span>
        </div>
      )}

      {/* 슬롯 모드 UI */}
      {useSlotMode ? (
        <div className="flex flex-col gap-4">
          <div className="grid min-h-[500px] grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 좌측: 슬롯 구성 패널 */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-4 text-sm font-medium text-gray-700">
                슬롯 구성
              </h3>
              <SlotConfigurationPanel
                slots={contentSlots}
                onSlotsChange={handleSlotsChange}
                selectedSlotIndex={selectedSlotIndex}
                onSlotSelect={setSelectedSlotIndex}
                editable={editable}
                templateSlots={templateSlots}
              />
            </div>

            {/* 우측: 콘텐츠 연결 패널 */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-4 text-sm font-medium text-gray-700">
                콘텐츠 연결
              </h3>
              <ContentLinkingPanel
                selectedSlot={selectedSlot}
                slotIndex={selectedSlotIndex}
                availableContents={availableContents}
                onLinkContent={handleLinkContent}
                onUnlinkContent={handleUnlinkContent}
                editable={editable}
                studentId={studentId}
              />
            </div>
          </div>

          {/* 가상 타임라인 미리보기 */}
          {showTimelinePreview && dailySchedules.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-700">
                  가상 타임라인 미리보기
                </span>
                {isTimelineExpanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {isTimelineExpanded && (
                <div className="border-t border-gray-200 p-4">
                  <VirtualTimelinePreview
                    slots={contentSlots}
                    dailySchedules={dailySchedules}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        // 기존 모드: 기존 Step3ContentSelection 사용
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="py-8 text-center text-sm text-gray-500">
            기존 콘텐츠 선택 UI가 여기에 표시됩니다.
            <br />
            (Step3ContentSelection 컴포넌트와 통합 필요)
          </div>
        </div>
      )}

      {/* 검증 요약 (슬롯 모드일 때만) */}
      {useSlotMode && contentSlots.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-gray-600">
                슬롯: {contentSlots.length}/9
              </span>
              <span className="text-gray-600">
                연결됨:{" "}
                {contentSlots.filter((s) => s.content_id).length}/
                {contentSlots.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {slotValidation.valid && linkingValidation.valid ? (
                <span className="text-green-600">준비 완료</span>
              ) : (
                <span className="text-amber-600">
                  {slotValidation.errors.length + linkingValidation.errors.length}개
                  항목 확인 필요
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Step3SlotModeSelection = memo(Step3SlotModeSelectionComponent);
