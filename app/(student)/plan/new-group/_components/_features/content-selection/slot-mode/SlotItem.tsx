"use client";

import React, { memo, useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import {
  ContentSlot,
  SlotType,
  getSlotCompletionStatus,
  SlotCompletionStatus,
} from "@/lib/types/content-selection";
import {
  BookOpen,
  Video,
  FileText,
  Clock,
  ClipboardList,
  GripVertical,
  Trash2,
  Lock,
  Check,
  ChevronDown,
  MoreVertical,
  Copy,
  ChevronUp,
  Link2,
  Unlink2,
} from "lucide-react";
import { SlotAdvancedSettings, GhostSlotActivator } from "./SlotAdvancedSettings";

// ============================================================================
// 타입 정의
// ============================================================================

type SubjectInfo = {
  id: string;
  name: string;
};

type SlotItemProps = {
  slot: ContentSlot;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (slot: ContentSlot) => void;
  onRemove: () => void;
  editable?: boolean;
  subjectCategories: string[];
  allSlots?: ContentSlot[];
  onActivateGhost?: (slot: ContentSlot) => void;
  onDismissGhost?: (slot: ContentSlot) => void;
  // 과목 목록 (subject_category에 해당하는 과목들)
  subjects?: SubjectInfo[];
  isLoadingSubjects?: boolean;
  // 드래그앤드롭 props
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  // 복제/이동 props
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canDuplicate?: boolean;
};

// ============================================================================
// 헬퍼 함수
// ============================================================================

const SLOT_TYPE_CONFIG: Record<
  SlotType,
  { icon: typeof BookOpen; label: string; color: string }
> = {
  book: { icon: BookOpen, label: "교재", color: "blue" },
  lecture: { icon: Video, label: "강의", color: "green" },
  custom: { icon: FileText, label: "커스텀", color: "purple" },
  self_study: { icon: Clock, label: "자습", color: "orange" },
  test: { icon: ClipboardList, label: "테스트", color: "red" },
};

const getSlotTypeIcon = (slotType: SlotType | null) => {
  if (!slotType) return null;
  return SLOT_TYPE_CONFIG[slotType];
};

const getCompletionStyles = (
  status: SlotCompletionStatus
): { border: string; bg: string } => {
  switch (status) {
    case "empty":
      return { border: "border-dashed border-gray-300", bg: "bg-gray-50" };
    case "type_selected":
      return { border: "border-solid border-blue-300", bg: "bg-blue-50/30" };
    case "content_linked":
      return { border: "border-solid border-green-400", bg: "bg-green-50/50" };
  }
};

// 연결된 슬롯 이름 가져오기
const getLinkedSlotName = (
  linkedSlotId: string | null | undefined,
  allSlots: ContentSlot[]
): string | null => {
  if (!linkedSlotId) return null;
  const linkedSlot = allSlots.find(
    (s) => String(s.slot_index) === linkedSlotId || s.id === linkedSlotId
  );
  if (!linkedSlot) return null;
  return `슬롯 ${linkedSlot.slot_index + 1}${linkedSlot.subject_category ? ` (${linkedSlot.subject_category})` : ""}`;
};

// 배타적 슬롯 이름들 가져오기
const getExclusiveSlotNames = (
  exclusiveWith: string[] | undefined,
  allSlots: ContentSlot[]
): string[] => {
  if (!exclusiveWith || exclusiveWith.length === 0) return [];
  return exclusiveWith
    .map((id) => {
      const slot = allSlots.find(
        (s) => String(s.slot_index) === id || s.id === id
      );
      if (!slot) return null;
      return `슬롯 ${slot.slot_index + 1}`;
    })
    .filter((name): name is string => name !== null);
};

// ============================================================================
// 컴포넌트
// ============================================================================

function SlotItemComponent({
  slot,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
  editable = true,
  subjectCategories,
  allSlots = [],
  onActivateGhost,
  onDismissGhost,
  // 과목 목록
  subjects = [],
  isLoadingSubjects = false,
  // 드래그앤드롭 props
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  // 복제/이동 props
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  canDuplicate = false,
}: SlotItemProps) {
  const completionStatus = getSlotCompletionStatus(slot);
  const styles = getCompletionStyles(completionStatus);
  const typeConfig = getSlotTypeIcon(slot.slot_type);
  const isLocked = slot.is_locked;
  const isGhost = slot.is_ghost;

  // 관계 정보 계산
  const linkedSlotName = getLinkedSlotName(slot.linked_slot_id, allSlots);
  const exclusiveSlotNames = getExclusiveSlotNames(slot.exclusive_with, allSlots);
  const hasRelationships = linkedSlotName || exclusiveSlotNames.length > 0;

  // 액션 메뉴 상태
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 슬롯 타입 변경
  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newType = e.target.value as SlotType | "";
      onUpdate({
        ...slot,
        slot_type: newType || null,
      });
    },
    [slot, onUpdate]
  );

  // 교과 변경
  const handleSubjectCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onUpdate({
        ...slot,
        subject_category: e.target.value,
        // 교과 변경 시 과목 초기화
        subject_id: null,
      });
    },
    [slot, onUpdate]
  );

  // 배정 방식 변경 (전략과목/취약과목)
  const handleSubjectTypeChange = useCallback(
    (newSubjectType: "strategy" | "weakness") => {
      onUpdate({
        ...slot,
        subject_type: newSubjectType,
        // 취약과목으로 변경 시 weekly_days 초기화
        weekly_days: newSubjectType === "weakness" ? null : (slot.weekly_days ?? 3),
      });
    },
    [slot, onUpdate]
  );

  // 주당 배정 일수 변경
  const handleWeeklyDaysChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const days = parseInt(e.target.value, 10);
      onUpdate({
        ...slot,
        weekly_days: isNaN(days) ? null : days,
      });
    },
    [slot, onUpdate]
  );

  // 과목 변경
  const handleSubjectIdChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const subjectId = e.target.value || null;
      onUpdate({
        ...slot,
        subject_id: subjectId,
      });
    },
    [slot, onUpdate]
  );

  // 메뉴 토글
  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  }, []);

  // 메뉴 외부 클릭 시 닫기
  const handleMenuAction = useCallback(
    (action: () => void) => {
      return (e: React.MouseEvent) => {
        e.stopPropagation();
        action();
        setIsMenuOpen(false);
      };
    },
    []
  );

  return (
    <div
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        // 기본 스타일 - 모바일에서 더 큰 패딩
        "group relative rounded-lg border-2 p-4 transition-all md:p-3",
        styles.border,
        styles.bg,
        isSelected && "ring-2 ring-blue-500 ring-offset-2",
        isGhost && "opacity-60",
        isDragging && "opacity-50 ring-2 ring-blue-400",
        isDragOver && "border-blue-500 bg-blue-50",
        editable && "cursor-pointer active:bg-gray-50 md:hover:shadow-md"
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* 드래그 핸들 & 인덱스 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 드래그 핸들 - 데스크톱에서만 표시 (모바일은 터치 드래그 미지원) */}
          {editable && (
            <GripVertical
              className={cn(
                "hidden h-4 w-4 cursor-grab text-gray-400 transition-colors md:block",
                "hover:text-gray-600 active:cursor-grabbing"
              )}
            />
          )}
          <span className="text-xs font-medium text-gray-500">
            슬롯 {index + 1}
          </span>
          {isLocked && (
            <span title="잠금 슬롯">
              <Lock className="h-3 w-3 text-amber-500" />
            </span>
          )}
          {isGhost && (
            <span className="text-xs text-gray-400">(추천)</span>
          )}
        </div>

        {/* 완성 상태 표시 및 액션 버튼 */}
        <div className="flex items-center gap-2">
          {completionStatus === "content_linked" && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}

          {/* 액션 메뉴 */}
          {editable && (
            <div className="relative">
              <button
                type="button"
                onClick={handleMenuToggle}
                className={cn(
                  "rounded p-1.5 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600",
                  // 모바일에서는 항상 표시, 데스크톱에서는 호버 시 표시
                  "md:opacity-0 md:group-hover:opacity-100",
                  isMenuOpen && "bg-gray-100 text-gray-600 !opacity-100"
                )}
                title="더보기"
              >
                <MoreVertical className="h-5 w-5 md:h-4 md:w-4" />
              </button>

              {/* 드롭다운 메뉴 */}
              {isMenuOpen && (
                <>
                  {/* 오버레이 */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                    }}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    {canMoveUp && (
                      <button
                        type="button"
                        onClick={handleMenuAction(onMoveUp!)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 active:bg-gray-100 md:gap-2 md:px-3 md:py-2 md:hover:bg-gray-50"
                      >
                        <ChevronUp className="h-5 w-5 md:h-4 md:w-4" />
                        위로 이동
                      </button>
                    )}
                    {canMoveDown && (
                      <button
                        type="button"
                        onClick={handleMenuAction(onMoveDown!)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 active:bg-gray-100 md:gap-2 md:px-3 md:py-2 md:hover:bg-gray-50"
                      >
                        <ChevronDown className="h-5 w-5 md:h-4 md:w-4" />
                        아래로 이동
                      </button>
                    )}
                    {canDuplicate && (
                      <button
                        type="button"
                        onClick={handleMenuAction(onDuplicate!)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 active:bg-gray-100 md:gap-2 md:px-3 md:py-2 md:hover:bg-gray-50"
                      >
                        <Copy className="h-5 w-5 md:h-4 md:w-4" />
                        복제
                      </button>
                    )}
                    {!isLocked && (
                      <>
                        {(canMoveUp || canMoveDown || canDuplicate) && (
                          <div className="my-1 border-t border-gray-100" />
                        )}
                        <button
                          type="button"
                          onClick={handleMenuAction(onRemove)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-600 active:bg-red-100 md:gap-2 md:px-3 md:py-2 md:hover:bg-red-50"
                        >
                          <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 관계 표시 배지 */}
      {hasRelationships && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {/* 연계 슬롯 표시 */}
          {linkedSlotName && (
            <div
              className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700"
              title={`${slot.link_type === "before" ? "이전" : "다음"}에 ${linkedSlotName} 배치`}
            >
              <Link2 className="h-3 w-3" />
              <span>
                {slot.link_type === "before" ? "→" : "←"} {linkedSlotName}
              </span>
            </div>
          )}

          {/* 배타적 슬롯 표시 */}
          {exclusiveSlotNames.length > 0 && (
            <div
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
              title={`${exclusiveSlotNames.join(", ")}과(와) 다른 날 배치`}
            >
              <Unlink2 className="h-3 w-3" />
              <span>
                ≠ {exclusiveSlotNames.length === 1
                  ? exclusiveSlotNames[0]
                  : `${exclusiveSlotNames.length}개 슬롯`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 슬롯 타입 선택 */}
      <div className="mb-3 md:mb-2">
        <div className="relative">
          <select
            value={slot.slot_type || ""}
            onChange={handleTypeChange}
            disabled={!editable || isLocked}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              // 모바일에서 더 큰 터치 타겟 (44px 이상)
              "w-full appearance-none rounded-md border bg-white px-3 py-3 pr-8 text-base md:py-2 md:text-sm",
              "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              (!editable || isLocked) && "cursor-not-allowed opacity-60"
            )}
          >
            <option value="">타입 선택</option>
            {Object.entries(SLOT_TYPE_CONFIG).map(([type, config]) => (
              <option key={type} value={type}>
                {config.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 md:right-2 md:h-4 md:w-4" />
        </div>
      </div>

      {/* 교과 선택 */}
      <div className="mb-3 md:mb-2">
        <div className="relative">
          <select
            value={slot.subject_category || ""}
            onChange={handleSubjectCategoryChange}
            disabled={!editable || isLocked}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              // 모바일에서 더 큰 터치 타겟 (44px 이상)
              "w-full appearance-none rounded-md border bg-white px-3 py-3 pr-8 text-base md:py-2 md:text-sm",
              "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              (!editable || isLocked) && "cursor-not-allowed opacity-60"
            )}
          >
            <option value="">교과 선택</option>
            {subjectCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 md:right-2 md:h-4 md:w-4" />
        </div>
      </div>

      {/* 과목 선택 (교과가 선택되고 과목 목록이 있는 경우) */}
      {slot.subject_category && subjects.length > 0 && (
        <div className="mb-3 md:mb-2">
          <div className="relative">
            <select
              value={slot.subject_id || ""}
              onChange={handleSubjectIdChange}
              disabled={!editable || isLocked || isLoadingSubjects}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-full appearance-none rounded-md border bg-white px-3 py-3 pr-8 text-base md:py-2 md:text-sm",
                "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                (!editable || isLocked || isLoadingSubjects) && "cursor-not-allowed opacity-60"
              )}
            >
              <option value="">과목 선택 (선택사항)</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 md:right-2 md:h-4 md:w-4" />
          </div>
        </div>
      )}

      {/* 배정 방식 (전략과목/취약과목) - 교과가 선택된 경우에만 표시 */}
      {slot.subject_category && (
        <div className="mb-3 md:mb-2">
          <div className="mb-1.5 text-xs font-medium text-gray-500">배정 방식</div>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {/* 취약과목 라디오 */}
            <label
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 py-2.5 text-sm transition-all md:py-2",
                slot.subject_type !== "strategy"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                (!editable || isLocked) && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="radio"
                name={`subject-type-${slot.slot_index}`}
                checked={slot.subject_type !== "strategy"}
                onChange={() => handleSubjectTypeChange("weakness")}
                disabled={!editable || isLocked}
                className="sr-only"
              />
              <span>취약과목</span>
              <span className="text-xs text-gray-400">(매일)</span>
            </label>
            {/* 전략과목 라디오 */}
            <label
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 py-2.5 text-sm transition-all md:py-2",
                slot.subject_type === "strategy"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                (!editable || isLocked) && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="radio"
                name={`subject-type-${slot.slot_index}`}
                checked={slot.subject_type === "strategy"}
                onChange={() => handleSubjectTypeChange("strategy")}
                disabled={!editable || isLocked}
                className="sr-only"
              />
              <span>전략과목</span>
            </label>
          </div>

          {/* 주당 배정 일수 (전략과목인 경우에만 표시) */}
          {slot.subject_type === "strategy" && (
            <div className="mt-2">
              <div className="relative">
                <select
                  value={slot.weekly_days ?? 3}
                  onChange={handleWeeklyDaysChange}
                  disabled={!editable || isLocked}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "w-full appearance-none rounded-md border bg-white px-3 py-2.5 pr-8 text-sm md:py-2",
                    "focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500",
                    (!editable || isLocked) && "cursor-not-allowed opacity-60"
                  )}
                >
                  <option value={2}>주 2일</option>
                  <option value={3}>주 3일 (기본)</option>
                  <option value={4}>주 4일</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 연결된 콘텐츠 표시 */}
      {slot.content_id && slot.title && (
        <div className="mt-2 rounded-md bg-white/80 p-2">
          <div className="flex items-center gap-2">
            {typeConfig && (
              <typeConfig.icon
                className={cn(
                  "h-4 w-4",
                  `text-${typeConfig.color}-500`
                )}
              />
            )}
            <span className="truncate text-sm font-medium text-gray-700">
              {slot.title}
            </span>
          </div>
          {slot.start_range !== undefined && slot.end_range !== undefined && (
            <div className="mt-1 text-xs text-gray-500">
              범위: {slot.start_range} - {slot.end_range}
              {slot.slot_type === "book" ? "p" : "회차"}
            </div>
          )}
        </div>
      )}

      {/* Ghost 슬롯 메시지 */}
      {isGhost && slot.ghost_message && (
        <div className="mt-2 text-xs italic text-gray-400">
          {slot.ghost_message}
        </div>
      )}

      {/* Ghost 슬롯 활성화/무시 버튼 */}
      {isGhost && onActivateGhost && onDismissGhost && (
        <GhostSlotActivator
          slot={slot}
          onActivate={() => onActivateGhost(slot)}
          onDismiss={() => onDismissGhost(slot)}
        />
      )}

      {/* 고급 설정 패널 (Ghost 슬롯이 아닐 때만) */}
      {!isGhost && slot.slot_type && (
        <SlotAdvancedSettings
          slot={slot}
          allSlots={allSlots}
          onUpdate={onUpdate}
          editable={editable && !isLocked}
        />
      )}
    </div>
  );
}

export const SlotItem = memo(SlotItemComponent);
