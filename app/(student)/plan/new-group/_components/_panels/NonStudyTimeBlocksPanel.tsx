"use client";

import React, { useState } from "react";
import { Info } from "lucide-react";
import { WizardData } from "../PlanGroupWizard";
import { useToast } from "@/components/ui/ToastProvider";

type NonStudyTimeBlocksPanelProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  campMode?: boolean;
  isTemplateMode?: boolean;
};

const weekdayLabels = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

/**
 * 학습 시간 제외 항목 패널
 * - 아침식사, 저녁식사, 수면 등 학습에서 제외할 시간대 관리
 */
export const NonStudyTimeBlocksPanel = React.memo(function NonStudyTimeBlocksPanel({
  data,
  onUpdate,
  campMode = false,
  isTemplateMode = false,
}: NonStudyTimeBlocksPanelProps) {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  
  // 템플릿 고정 필드 확인
  const lockedFields = data.templateLockedFields?.step2 || {};
  
  // 템플릿 모드에서 필드 제어 토글
  const toggleFieldControl = (fieldName: keyof typeof lockedFields) => {
    if (!isTemplateMode) return;
    
    const currentLocked = data.templateLockedFields?.step2 || {};
    const newLocked = {
      ...currentLocked,
      [fieldName]: !currentLocked[fieldName],
    };
    
    onUpdate({
      templateLockedFields: {
        ...data.templateLockedFields,
        step2: newLocked,
      },
    });
  };
  
  // 학생 입력 가능 여부
  const canStudentInputNonStudyTimeBlocks = campMode
    ? (lockedFields.allow_student_non_study_time_blocks !== false)
    : true;

  // 로컬 상태
  const [newNonStudyTimeBlock, setNewNonStudyTimeBlock] = useState<{
    type: "아침식사" | "저녁식사" | "수면" | "기타";
    start_time: string;
    end_time: string;
    day_of_week?: number[];
    description?: string;
  }>({
    type: "아침식사",
    start_time: "07:00",
    end_time: "08:00",
  });

  const addNonStudyTimeBlock = () => {
    if (!newNonStudyTimeBlock.start_time || !newNonStudyTimeBlock.end_time) {
      toast.showError("시작 시간과 종료 시간을 입력해주세요.");
      return;
    }
    if (newNonStudyTimeBlock.start_time >= newNonStudyTimeBlock.end_time) {
      toast.showError("시작 시간은 종료 시간보다 앞서야 합니다.");
      return;
    }

    const updated = [...(data.non_study_time_blocks || []), { ...newNonStudyTimeBlock }];
    onUpdate({ non_study_time_blocks: updated });
    
    // 폼 초기화
    setNewNonStudyTimeBlock({
      type: "아침식사",
      start_time: "07:00",
      end_time: "08:00",
    });
  };

  const removeNonStudyTimeBlock = (index: number) => {
    const updated = [...(data.non_study_time_blocks || [])];
    updated.splice(index, 1);
    onUpdate({ non_study_time_blocks: updated.length > 0 ? updated : undefined });
  };

  const toggleWeekday = (day: number) => {
    const currentDays = newNonStudyTimeBlock.day_of_week || [];
    const updatedDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    setNewNonStudyTimeBlock({
      ...newNonStudyTimeBlock,
      day_of_week: updatedDays.length > 0 ? updatedDays : undefined,
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">학습 시간 제외 항목</h3>
          <Info className="h-4 w-4 text-gray-400" />
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <span className="text-gray-400">{isOpen ? "▲" : "▼"}</span>
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-gray-200 pt-4">
          <p className="mb-4 text-xs text-gray-600">
            학습 시간 내에서 플랜 배정을 제외할 시간대를 설정합니다. (식사 시간, 수면 시간 등)
          </p>

          {/* 기존 제외 항목 목록 */}
          {data.non_study_time_blocks && data.non_study_time_blocks.length > 0 && (
            <div className="mb-4 space-y-2">
              {data.non_study_time_blocks.map((block, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{block.type}</div>
                    <div className="text-xs text-gray-600">
                      {block.start_time} ~ {block.end_time}
                      {block.day_of_week && block.day_of_week.length > 0 && (
                        <span className="ml-2">
                          ({block.day_of_week.map((d) => weekdayLabels[d]).join(", ")})
                        </span>
                      )}
                    </div>
                    {block.description && (
                      <div className="mt-1 text-xs text-gray-500">{block.description}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeNonStudyTimeBlock(index)}
                    className="ml-2 text-xs text-red-600 hover:text-red-800"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 새 제외 항목 추가 폼 */}
          {(!campMode || canStudentInputNonStudyTimeBlocks) && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">새 제외 항목 추가</h4>
              
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">제외 항목 유형</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  value={newNonStudyTimeBlock.type}
                  onChange={(e) =>
                    setNewNonStudyTimeBlock({
                      ...newNonStudyTimeBlock,
                      type: e.target.value as any,
                    })
                  }
                >
                  <option value="아침식사">아침식사</option>
                  <option value="저녁식사">저녁식사</option>
                  <option value="수면">수면</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">시작 시간</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                    value={newNonStudyTimeBlock.start_time}
                    onChange={(e) =>
                      setNewNonStudyTimeBlock({
                        ...newNonStudyTimeBlock,
                        start_time: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">종료 시간</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none"
                    value={newNonStudyTimeBlock.end_time}
                    onChange={(e) =>
                      setNewNonStudyTimeBlock({
                        ...newNonStudyTimeBlock,
                        end_time: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">적용 요일 (선택사항, 없으면 매일)</label>
                <div className="flex flex-wrap gap-2">
                  {weekdayLabels.map((label, day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        (newNonStudyTimeBlock.day_of_week || []).includes(day)
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">설명 (선택사항)</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  placeholder="예: 점심 식사 시간"
                  value={newNonStudyTimeBlock.description || ""}
                  onChange={(e) =>
                    setNewNonStudyTimeBlock({
                      ...newNonStudyTimeBlock,
                      description: e.target.value || undefined,
                    })
                  }
                />
              </div>

              <button
                type="button"
                onClick={addNonStudyTimeBlock}
                className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                제외 항목 추가
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

