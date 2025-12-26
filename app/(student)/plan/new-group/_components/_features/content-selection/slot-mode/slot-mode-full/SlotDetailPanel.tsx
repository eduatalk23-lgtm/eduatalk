"use client";

import React, { memo, useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import { ContentSlot, SlotType } from "@/lib/types/content-selection";
import {
  BookOpen,
  Video,
  FileText,
  Clock,
  ClipboardList,
  ChevronDown,
  Loader2,
  Settings,
} from "lucide-react";
import { getSubjectsByGroupNameAction } from "@/lib/domains/subject";

// ============================================================================
// 타입 정의
// ============================================================================

type SubjectInfo = {
  id: string;
  name: string;
};

type SlotDetailPanelProps = {
  selectedSlot: ContentSlot | null;
  slotIndex: number | null;
  onSlotUpdate: (index: number, slot: ContentSlot) => void;
  editable?: boolean;
  subjectCategories?: string[];
  className?: string;
};

// ============================================================================
// 상수
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

// DB subject_groups 테이블의 실제 name 값과 일치해야 함
const DEFAULT_SUBJECT_CATEGORIES = [
  "국어", "수학", "영어", "과학", "사회(역사/도덕 포함)", "한국사",
];

// ============================================================================
// 메인 컴포넌트
// ============================================================================

function SlotDetailPanelComponent({
  selectedSlot,
  slotIndex,
  onSlotUpdate,
  editable = true,
  subjectCategories = DEFAULT_SUBJECT_CATEGORIES,
  className,
}: SlotDetailPanelProps) {
  // 과목 로딩 상태
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  // 교과 선택 시 과목 로드
  useEffect(() => {
    if (!selectedSlot?.subject_category) {
      setSubjects([]);
      return;
    }

    const loadSubjects = async () => {
      setIsLoadingSubjects(true);
      try {
        const result = await getSubjectsByGroupNameAction(selectedSlot.subject_category!);
        setSubjects(result.map(s => ({ id: s.id, name: s.name })));
      } catch (error) {
        console.error("[SlotDetailPanel] 과목 로드 실패:", error);
        setSubjects([]);
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    loadSubjects();
  }, [selectedSlot?.subject_category]);

  // 슬롯 업데이트 핸들러
  const handleSlotUpdate = useCallback(
    (updates: Partial<ContentSlot>) => {
      if (slotIndex === null || !selectedSlot) return;
      onSlotUpdate(slotIndex, { ...selectedSlot, ...updates });
    },
    [slotIndex, selectedSlot, onSlotUpdate]
  );

  // 슬롯 타입 변경
  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleSlotUpdate({ slot_type: (e.target.value as SlotType) || null });
    },
    [handleSlotUpdate]
  );

  // 교과 변경 - 과목 관련 필드도 초기화
  const handleSubjectCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleSlotUpdate({
        subject_category: e.target.value,
        subject_id: null,
        subject: null,
      });
    },
    [handleSlotUpdate]
  );

  // 과목 변경 - subject_id와 함께 subject(과목명)도 저장
  const handleSubjectIdChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedId = e.target.value || null;
      const selectedSubject = subjects.find(s => s.id === selectedId);
      handleSlotUpdate({
        subject_id: selectedId,
        subject: selectedSubject?.name ?? null,
      });
    },
    [handleSlotUpdate, subjects]
  );

  // 배정 방식 변경
  const handleSubjectTypeChange = useCallback(
    (subjectType: "strategy" | "weakness") => {
      handleSlotUpdate({
        subject_type: subjectType,
        weekly_days: subjectType === "weakness" ? null : (selectedSlot?.weekly_days ?? 3),
      });
    },
    [handleSlotUpdate, selectedSlot?.weekly_days]
  );

  // 주당 일수 변경
  const handleWeeklyDaysChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const days = parseInt(e.target.value, 10);
      handleSlotUpdate({ weekly_days: isNaN(days) ? null : days });
    },
    [handleSlotUpdate]
  );

  // 메모 변경
  const handleMemoChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleSlotUpdate({ memo: e.target.value || null });
    },
    [handleSlotUpdate]
  );


  // ============================================================================
  // 슬롯 미선택 상태
  // ============================================================================
  if (!selectedSlot || slotIndex === null) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Settings className="h-4 w-4" />
          슬롯 상세
        </div>
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-4">
          <div className="text-center text-sm text-gray-400">
            왼쪽에서 슬롯을<br />선택하세요
          </div>
        </div>
      </div>
    );
  }

  const isLocked = selectedSlot.is_locked;

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* 헤더 */}
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
        <Settings className="h-4 w-4" />
        슬롯 {slotIndex + 1} 상세
      </div>

      {/* 설정 폼 */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {/* 슬롯 타입 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">슬롯 타입</label>
          <div className="relative">
            <select
              value={selectedSlot.slot_type || ""}
              onChange={handleTypeChange}
              disabled={!editable || isLocked}
              className={cn(
                "w-full appearance-none rounded-lg border bg-white px-3 py-2.5 pr-8 text-sm",
                "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                (!editable || isLocked) && "cursor-not-allowed opacity-60"
              )}
            >
              <option value="">타입 선택</option>
              {Object.entries(SLOT_TYPE_CONFIG).map(([type, config]) => (
                <option key={type} value={type}>{config.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {/* 교과 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">교과</label>
          <div className="relative">
            <select
              value={selectedSlot.subject_category || ""}
              onChange={handleSubjectCategoryChange}
              disabled={!editable || isLocked}
              className={cn(
                "w-full appearance-none rounded-lg border bg-white px-3 py-2.5 pr-8 text-sm",
                "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                (!editable || isLocked) && "cursor-not-allowed opacity-60"
              )}
            >
              <option value="">교과 선택</option>
              {subjectCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        {/* 과목 */}
        {selectedSlot.subject_category && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">과목 (선택)</label>
            {isLoadingSubjects ? (
              <div className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                로딩 중...
              </div>
            ) : subjects.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedSlot.subject_id || ""}
                  onChange={handleSubjectIdChange}
                  disabled={!editable || isLocked}
                  className={cn(
                    "w-full appearance-none rounded-lg border bg-white px-3 py-2.5 pr-8 text-sm",
                    "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                    (!editable || isLocked) && "cursor-not-allowed opacity-60"
                  )}
                >
                  <option value="">과목 선택</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            ) : (
              <div className="rounded-lg border bg-gray-50 px-3 py-2.5 text-xs text-gray-400">
                등록된 과목 없음
              </div>
            )}
          </div>
        )}

        {/* 배정 방식 */}
        {selectedSlot.subject_category && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">배정 방식</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleSubjectTypeChange("weakness")}
                disabled={!editable || isLocked}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition-all",
                  selectedSlot.subject_type !== "strategy"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                  (!editable || isLocked) && "cursor-not-allowed opacity-60"
                )}
              >
                취약
              </button>
              <button
                type="button"
                onClick={() => handleSubjectTypeChange("strategy")}
                disabled={!editable || isLocked}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition-all",
                  selectedSlot.subject_type === "strategy"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                  (!editable || isLocked) && "cursor-not-allowed opacity-60"
                )}
              >
                전략
              </button>
            </div>

            {/* 주당 배정 일수 */}
            {selectedSlot.subject_type === "strategy" && (
              <div className="mt-2">
                <div className="relative">
                  <select
                    value={selectedSlot.weekly_days ?? 3}
                    onChange={handleWeeklyDaysChange}
                    disabled={!editable || isLocked}
                    className={cn(
                      "w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-8 text-xs",
                      "focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500",
                      (!editable || isLocked) && "cursor-not-allowed opacity-60"
                    )}
                  >
                    <option value={2}>주 2일</option>
                    <option value={3}>주 3일</option>
                    <option value={4}>주 4일</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 메모 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            메모
          </label>
          <textarea
            value={selectedSlot.memo || ""}
            onChange={handleMemoChange}
            disabled={!editable || isLocked}
            placeholder="콘텐츠 메타 정보 (예: 3단원까지 선행 필요)"
            rows={2}
            className={cn(
              "w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm",
              "placeholder:text-gray-400",
              "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              (!editable || isLocked) && "cursor-not-allowed opacity-60"
            )}
          />
        </div>

      </div>
    </div>
  );
}

export const SlotDetailPanel = memo(SlotDetailPanelComponent);
