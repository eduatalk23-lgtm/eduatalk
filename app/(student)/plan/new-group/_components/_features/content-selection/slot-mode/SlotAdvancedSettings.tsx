"use client";

import React, { memo, useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import type {
  ContentSlot,
  SelfStudyPurpose,
  SlotTimeConstraint,
} from "@/lib/types/content-selection";
import {
  Settings,
  Clock,
  Link2,
  Unlink2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  Plus,
} from "lucide-react";

// ============================================================================
// 타입 정의
// ============================================================================

type SlotAdvancedSettingsProps = {
  slot: ContentSlot;
  allSlots: ContentSlot[];
  onUpdate: (slot: ContentSlot) => void;
  editable?: boolean;
  className?: string;
};

// ============================================================================
// 상수
// ============================================================================

const SELF_STUDY_PURPOSE_OPTIONS: {
  value: SelfStudyPurpose;
  label: string;
  description: string;
}[] = [
  { value: "homework", label: "숙제", description: "학교/학원 과제 수행" },
  { value: "review", label: "복습", description: "오답노트, 복습 정리" },
  { value: "preview", label: "예습", description: "다음 진도 미리 학습" },
  { value: "memorization", label: "암기", description: "단어, 공식 암기" },
  { value: "practice", label: "문제풀이", description: "추가 문제 연습" },
];

const TIME_CONSTRAINT_OPTIONS = [
  { value: "flexible", label: "유동", description: "자투리 시간에 배치 가능" },
  { value: "fixed", label: "고정", description: "특정 시간대에만 배치" },
];

const LINK_TYPE_OPTIONS = [
  { value: "after", label: "다음에", description: "이 슬롯 이후에 배치" },
  { value: "before", label: "이전에", description: "이 슬롯 이전에 배치" },
];

// ============================================================================
// 컴포넌트
// ============================================================================

function SlotAdvancedSettingsComponent({
  slot,
  allSlots,
  onUpdate,
  editable = true,
  className,
}: SlotAdvancedSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 자습 목적 변경
  const handleSelfStudyPurposeChange = useCallback(
    (purpose: SelfStudyPurpose | null) => {
      onUpdate({
        ...slot,
        self_study_purpose: purpose,
      });
    },
    [slot, onUpdate]
  );

  // 시간 제약 타입 변경
  const handleTimeConstraintTypeChange = useCallback(
    (type: "fixed" | "flexible") => {
      onUpdate({
        ...slot,
        time_constraint: {
          type,
          preferred_time_range: type === "fixed" ? { start_hour: 21, end_hour: 23 } : null,
          can_split: type === "flexible",
        },
      });
    },
    [slot, onUpdate]
  );

  // 시간 범위 변경
  const handleTimeRangeChange = useCallback(
    (field: "start_hour" | "end_hour", value: number) => {
      const currentConstraint = slot.time_constraint || {
        type: "fixed" as const,
        preferred_time_range: { start_hour: 21, end_hour: 23 },
        can_split: false,
      };

      onUpdate({
        ...slot,
        time_constraint: {
          ...currentConstraint,
          preferred_time_range: {
            start_hour: field === "start_hour" ? value : (currentConstraint.preferred_time_range?.start_hour ?? 21),
            end_hour: field === "end_hour" ? value : (currentConstraint.preferred_time_range?.end_hour ?? 23),
          },
        },
      });
    },
    [slot, onUpdate]
  );

  // 슬롯 연결 변경
  const handleLinkedSlotChange = useCallback(
    (linkedSlotId: string | null) => {
      onUpdate({
        ...slot,
        linked_slot_id: linkedSlotId,
      });
    },
    [slot, onUpdate]
  );

  // 연결 타입 변경
  const handleLinkTypeChange = useCallback(
    (linkType: "after" | "before" | null) => {
      onUpdate({
        ...slot,
        link_type: linkType,
      });
    },
    [slot, onUpdate]
  );

  // 배타적 슬롯 추가
  const handleAddExclusiveSlot = useCallback(
    (excludedSlotId: string) => {
      const currentExclusive = slot.exclusive_with || [];
      if (currentExclusive.includes(excludedSlotId)) return;
      onUpdate({
        ...slot,
        exclusive_with: [...currentExclusive, excludedSlotId],
      });
    },
    [slot, onUpdate]
  );

  // 배타적 슬롯 제거
  const handleRemoveExclusiveSlot = useCallback(
    (excludedSlotId: string) => {
      const currentExclusive = slot.exclusive_with || [];
      onUpdate({
        ...slot,
        exclusive_with: currentExclusive.filter((id) => id !== excludedSlotId),
      });
    },
    [slot, onUpdate]
  );

  // 자습 타입이 아니면 자습 목적 선택 숨김
  const showSelfStudyOptions = slot.slot_type === "self_study";

  // 연결 가능한 다른 슬롯들
  const linkableSlots = allSlots.filter(
    (s) => s.slot_index !== slot.slot_index && s.slot_type
  );

  // 배타적 관계에 추가 가능한 슬롯들 (이미 추가된 슬롯 제외)
  const availableForExclusive = linkableSlots.filter(
    (s) => !slot.exclusive_with?.includes(String(s.slot_index))
  );

  // 현재 배타적 관계에 있는 슬롯들
  const exclusiveSlots = (slot.exclusive_with || [])
    .map((id) => allSlots.find((s) => String(s.slot_index) === id))
    .filter((s): s is ContentSlot => s !== undefined);

  if (!editable) return null;

  return (
    <div className={cn("mt-2", className)}>
      {/* 토글 버튼 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="flex w-full items-center justify-between rounded-md bg-gray-100 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-200"
      >
        <div className="flex items-center gap-1">
          <Settings className="h-3 w-3" />
          <span>고급 설정</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {/* 확장된 설정 패널 */}
      {isExpanded && (
        <div
          className="mt-2 space-y-3 rounded-md border border-gray-200 bg-white p-3"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 자습 목적 (자습 타입일 때만) */}
          {showSelfStudyOptions && (
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-gray-700">
                <Clock className="h-3 w-3" />
                자습 목적
              </label>
              <div className="grid grid-cols-2 gap-1">
                {SELF_STUDY_PURPOSE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      handleSelfStudyPurposeChange(
                        slot.self_study_purpose === option.value
                          ? null
                          : option.value
                      )
                    }
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                      slot.self_study_purpose === option.value
                        ? "border-orange-400 bg-orange-50 text-orange-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    )}
                  >
                    <div className="font-medium">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 시간 제약 */}
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-gray-700">
              <Clock className="h-3 w-3" />
              시간 배치
            </label>
            <div className="flex gap-1">
              {TIME_CONSTRAINT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    handleTimeConstraintTypeChange(
                      option.value as "fixed" | "flexible"
                    )
                  }
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors",
                    slot.time_constraint?.type === option.value
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* 고정 시간 선택 */}
            {slot.time_constraint?.type === "fixed" && (
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={slot.time_constraint.preferred_time_range?.start_hour ?? 21}
                  onChange={(e) =>
                    handleTimeRangeChange("start_hour", Number(e.target.value))
                  }
                  className="rounded border border-gray-200 px-2 py-1 text-xs"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}시
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">~</span>
                <select
                  value={slot.time_constraint.preferred_time_range?.end_hour ?? 23}
                  onChange={(e) =>
                    handleTimeRangeChange("end_hour", Number(e.target.value))
                  }
                  className="rounded border border-gray-200 px-2 py-1 text-xs"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}시
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 슬롯 연결 */}
          {linkableSlots.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-gray-700">
                <Link2 className="h-3 w-3" />
                슬롯 연결 (순서 강제)
              </label>

              {slot.linked_slot_id ? (
                <div className="flex items-center gap-2">
                  <select
                    value={slot.link_type || "after"}
                    onChange={(e) =>
                      handleLinkTypeChange(e.target.value as "after" | "before")
                    }
                    className="rounded border border-gray-200 px-2 py-1 text-xs"
                  >
                    {LINK_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={slot.linked_slot_id}
                    onChange={(e) => handleLinkedSlotChange(e.target.value || null)}
                    className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs"
                  >
                    <option value="">연결 해제</option>
                    {linkableSlots.map((s) => (
                      <option key={s.slot_index} value={String(s.slot_index)}>
                        슬롯 {s.slot_index + 1} ({s.subject_category || "미정"})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      handleLinkedSlotChange(null);
                      handleLinkTypeChange(null);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <select
                  value=""
                  onChange={(e) => {
                    handleLinkedSlotChange(e.target.value);
                    handleLinkTypeChange("after");
                  }}
                  className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
                >
                  <option value="">슬롯 연결 선택...</option>
                  {linkableSlots.map((s) => (
                    <option key={s.slot_index} value={String(s.slot_index)}>
                      슬롯 {s.slot_index + 1} ({s.subject_category || "미정"})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* 배타적 슬롯 (다른 날 배치) */}
          {linkableSlots.length > 0 && (
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium text-gray-700">
                <Unlink2 className="h-3 w-3" />
                다른 날 배치 (배타적)
              </label>

              {/* 현재 배타적 관계에 있는 슬롯들 */}
              {exclusiveSlots.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {exclusiveSlots.map((s) => (
                    <div
                      key={s.slot_index}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                    >
                      <span>슬롯 {s.slot_index + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExclusiveSlot(String(s.slot_index))}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-amber-200"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 추가 가능한 슬롯 선택 */}
              {availableForExclusive.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddExclusiveSlot(e.target.value);
                    }
                  }}
                  className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs"
                >
                  <option value="">다른 날 배치할 슬롯 추가...</option>
                  {availableForExclusive.map((s) => (
                    <option key={s.slot_index} value={String(s.slot_index)}>
                      슬롯 {s.slot_index + 1} ({s.subject_category || "미정"})
                    </option>
                  ))}
                </select>
              )}

              {exclusiveSlots.length === 0 && availableForExclusive.length === 0 && (
                <div className="text-xs text-gray-400">
                  추가할 수 있는 슬롯이 없습니다
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Ghost 슬롯 활성화 버튼
// ============================================================================

type GhostSlotActivatorProps = {
  slot: ContentSlot;
  onActivate: () => void;
  onDismiss: () => void;
};

export function GhostSlotActivator({
  slot,
  onActivate,
  onDismiss,
}: GhostSlotActivatorProps) {
  if (!slot.is_ghost) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onActivate();
        }}
        className="flex flex-1 items-center justify-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600"
      >
        <Sparkles className="h-3 w-3" />
        추천 수락
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="rounded-md bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-300"
      >
        무시
      </button>
    </div>
  );
}

export const SlotAdvancedSettings = memo(SlotAdvancedSettingsComponent);
