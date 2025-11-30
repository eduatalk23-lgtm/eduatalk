"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Info, RefreshCw, Lock, Clock, User } from "lucide-react";
import { WizardData } from "../PlanGroupWizard";
import { useToast } from "@/components/ui/ToastProvider";
import { syncTimeManagementExclusionsAction } from "@/app/(student)/actions/planGroupActions";
import { ExclusionImportModal } from "./_modals/ExclusionImportModal";

type ExclusionsPanelProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  periodStart: string;
  periodEnd: string;
  groupId?: string;
  onNavigateToStep?: (step: number) => void;
  campMode?: boolean;
  isTemplateMode?: boolean;
  templateExclusions?: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
  }>;
  editable?: boolean;
};

type ExclusionInputType = "single" | "range" | "multiple";

const exclusionTypes = [
  { value: "휴가", label: "휴가" },
  { value: "개인사정", label: "개인사정" },
  { value: "휴일지정", label: "휴일지정" },
  { value: "기타", label: "기타" },
] as const;

/**
 * 제외일 관리 패널
 * - 단일/범위/다중 날짜 입력
 * - 시간 관리에서 불러오기
 * - 템플릿 제외일 관리
 */
export const ExclusionsPanel = React.memo(function ExclusionsPanel({
  data,
  onUpdate,
  periodStart,
  periodEnd,
  groupId,
  onNavigateToStep,
  campMode = false,
  isTemplateMode = false,
  templateExclusions,
  editable = true,
}: ExclusionsPanelProps) {
  const toast = useToast();
  
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
  const canStudentInputExclusions = campMode 
    ? (lockedFields.allow_student_exclusions !== false)
    : true;

  // 로컬 상태
  const [exclusionInputType, setExclusionInputType] = useState<ExclusionInputType>("single");
  const [newExclusionDate, setNewExclusionDate] = useState("");
  const [newExclusionStartDate, setNewExclusionStartDate] = useState("");
  const [newExclusionEndDate, setNewExclusionEndDate] = useState("");
  const [newExclusionDates, setNewExclusionDates] = useState<string[]>([]);
  const [newExclusionType, setNewExclusionType] = useState<"휴가" | "개인사정" | "휴일지정" | "기타">("휴가");
  const [newExclusionReason, setNewExclusionReason] = useState("");
  
  // 모달 상태
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [availableExclusions, setAvailableExclusions] = useState<Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
    source?: "time_management";
  }>>([]);
  
  // 불러올 수 있는 제외일 개수 상태
  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);

  const toggleExclusionDate = (date: string) => {
    setNewExclusionDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  // 불러올 수 있는 제외일 개수 조회
  const loadAvailableCount = async () => {
    try {
      setIsLoadingCount(true);
      const result = await syncTimeManagementExclusionsAction(
        groupId || null,
        periodStart,
        periodEnd
      );
      
      if (result.exclusions && result.exclusions.length > 0) {
        // 기존 제외일과 중복되지 않는 항목만 카운트
        const existingDates = new Set(data.exclusions.map((e) => e.exclusion_date));
        const newCount = result.exclusions.filter(
          (e) => !existingDates.has(e.exclusion_date)
        ).length;
        setAvailableCount(newCount);
      } else {
        setAvailableCount(0);
      }
    } catch (error) {
      console.error("제외일 개수 조회 실패:", error);
      setAvailableCount(null);
    } finally {
      setIsLoadingCount(false);
    }
  };

  // 컴포넌트 마운트 시 및 기간/기존 제외일 변경 시 개수 조회
  useEffect(() => {
    if (editable && periodStart && periodEnd) {
      loadAvailableCount();
    }
  }, [periodStart, periodEnd, data.exclusions.length]);

  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    const current = new Date(startDate);

    while (current <= endDate) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const addExclusion = () => {
    let datesToAdd: string[] = [];

    if (exclusionInputType === "single") {
      if (!newExclusionDate) {
        toast.showError("날짜를 선택해주세요.");
        return;
      }
      datesToAdd = [newExclusionDate];
    } else if (exclusionInputType === "range") {
      if (!newExclusionStartDate || !newExclusionEndDate) {
        toast.showError("시작일과 종료일을 선택해주세요.");
        return;
      }
      if (new Date(newExclusionStartDate) > new Date(newExclusionEndDate)) {
        toast.showError("시작일은 종료일보다 앞서야 합니다.");
        return;
      }
      datesToAdd = generateDateRange(newExclusionStartDate, newExclusionEndDate);
    } else if (exclusionInputType === "multiple") {
      if (newExclusionDates.length === 0) {
        toast.showError("날짜를 최소 1개 이상 선택해주세요.");
        return;
      }
      datesToAdd = [...newExclusionDates];
    }

    // 기존 제외일과 중복 체크
    const existingDates = new Set(data.exclusions.map((e) => e.exclusion_date));
    const duplicates = datesToAdd.filter((date) => existingDates.has(date));

    if (duplicates.length > 0) {
      toast.showError(`이미 등록된 제외일이 있습니다: ${duplicates.join(", ")}`);
      return;
    }

    // 새 제외일 추가
    const newExclusions = datesToAdd.map((date) => ({
      exclusion_date: date,
      exclusion_type: newExclusionType,
      reason: newExclusionReason || undefined,
      source: isTemplateMode ? ("template" as const) : ("student" as const),
      is_locked: isTemplateMode ? true : undefined,
    }));

    onUpdate({
      exclusions: [...data.exclusions, ...newExclusions],
    });

    // 폼 초기화
    setNewExclusionDate("");
    setNewExclusionStartDate("");
    setNewExclusionEndDate("");
    setNewExclusionDates([]);
    setNewExclusionReason("");
  };

  const removeExclusion = (index: number) => {
    const exclusion = data.exclusions[index];
    const isTemplateExclusion = exclusion.is_locked || exclusion.source === "template";
    
    if (campMode && isTemplateExclusion) {
      toast.showError("템플릿에서 지정된 제외일은 삭제할 수 없습니다.");
      return;
    }
    
    onUpdate({
      exclusions: data.exclusions.filter((_, i) => i !== index),
    });
  };

  const syncFromTimeManagement = async () => {
    try {
      const result = await syncTimeManagementExclusionsAction(
        groupId || null,
        periodStart,
        periodEnd
      );
      
      if (result.exclusions && result.exclusions.length > 0) {
        // 모달로 선택 등록 방식으로 변경
        setAvailableExclusions(result.exclusions);
        setIsImportModalOpen(true);
      } else {
        toast.showInfo("플랜 기간 내 등록된 제외일이 없습니다.");
      }
    } catch (error) {
      toast.showError(
        error instanceof Error
          ? error.message
          : "제외일 불러오기에 실패했습니다."
      );
    }
  };

  const handleImportExclusions = (selectedExclusions: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
    source?: "time_management";
  }>) => {
    const newExclusions = selectedExclusions.map((e) => ({
      ...e,
      source: "time_management" as const,
    }));
    
    onUpdate({
      exclusions: [...data.exclusions, ...newExclusions],
    });
    
    toast.showSuccess(`${newExclusions.length}개의 제외일을 등록했습니다.`);
    
    // 등록 후 개수 다시 조회
    loadAvailableCount();
  };

  return (
    <>
      {/* 제외일 불러오기 모달 */}
      <ExclusionImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        availableExclusions={availableExclusions}
        existingExclusions={data.exclusions}
        onImport={handleImportExclusions}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />

      <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">학습 제외일</h3>
          {isTemplateMode && (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={lockedFields.allow_student_exclusions === true}
                onChange={() => toggleFieldControl("allow_student_exclusions")}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span>학생 입력 허용</span>
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={syncFromTimeManagement}
            disabled={!editable}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isLoadingCount ? "animate-spin" : ""}`} />
            시간 관리에서 불러오기
          </button>
          {availableCount !== null && availableCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {availableCount}개
            </span>
          )}
        </div>
      </div>

      {/* 제외일 추가 폼 */}
      {editable && (!campMode || canStudentInputExclusions) && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {/* 입력 유형 선택 */}
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setExclusionInputType("single")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                exclusionInputType === "single"
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              단일 날짜
            </button>
            <button
              type="button"
              onClick={() => setExclusionInputType("range")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                exclusionInputType === "range"
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              시작일 ~ 종료일
            </button>
            <button
              type="button"
              onClick={() => setExclusionInputType("multiple")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                exclusionInputType === "multiple"
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              비연속 다중 선택
            </button>
          </div>

          {/* 날짜 입력 */}
          {exclusionInputType === "single" && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                날짜
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                value={newExclusionDate}
                onChange={(e) => setNewExclusionDate(e.target.value)}
                min={periodStart}
                max={periodEnd}
              />
            </div>
          )}

          {exclusionInputType === "range" && (
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  시작일
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  value={newExclusionStartDate}
                  onChange={(e) => setNewExclusionStartDate(e.target.value)}
                  min={periodStart}
                  max={periodEnd}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  종료일
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  value={newExclusionEndDate}
                  onChange={(e) => setNewExclusionEndDate(e.target.value)}
                  min={periodStart}
                  max={periodEnd}
                />
              </div>
            </div>
          )}

          {exclusionInputType === "multiple" && (
            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium text-gray-700">
                날짜 선택 (다중 선택 가능)
              </label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-300 bg-white p-2">
                {(() => {
                  const dates: string[] = [];
                  const start = new Date(periodStart);
                  const end = new Date(periodEnd);
                  const current = new Date(start);

                  while (current <= end) {
                    dates.push(current.toISOString().split("T")[0]);
                    current.setDate(current.getDate() + 1);
                  }

                  return dates.map((date) => {
                    const isSelected = newExclusionDates.includes(date);
                    const isExcluded = data.exclusions.some(
                      (e) => e.exclusion_date === date
                    );
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => !isExcluded && toggleExclusionDate(date)}
                        disabled={isExcluded}
                        className={`w-full rounded px-2 py-1 text-left text-xs transition-colors ${
                          isExcluded
                            ? "cursor-not-allowed bg-gray-100 text-gray-400 line-through"
                            : isSelected
                            ? "bg-gray-900 text-white"
                            : "hover:bg-gray-100 text-gray-700"
                        }`}
                      >
                        {date} {isExcluded && "(이미 제외됨)"}
                      </button>
                    );
                  });
                })()}
              </div>
              {newExclusionDates.length > 0 && (
                <p className="mt-2 text-xs text-gray-600">
                  {newExclusionDates.length}개 날짜 선택됨
                </p>
              )}
            </div>
          )}

          {/* 유형 및 사유 */}
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center gap-1">
                <label className="block text-xs font-medium text-gray-700">
                  유형
                </label>
                {data.scheduler_type === "1730_timetable" && (
                  <div className="group relative">
                    <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                    <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-2 text-xs text-gray-700 shadow-lg group-hover:block">
                      <div className="space-y-1">
                        <div className="font-semibold">유형별 안내</div>
                        <div className="border-t border-gray-100 pt-1">
                          <div className="font-medium text-gray-900">지정휴일:</div>
                          <div className="text-gray-600">
                            학습 분량은 배정되지 않지만, 자율 학습은 가능합니다.
                          </div>
                        </div>
                        <div className="border-t border-gray-100 pt-1">
                          <div className="font-medium text-gray-900">휴가/개인사정:</div>
                          <div className="text-gray-600">
                            학습이 불가능한 날입니다.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                value={newExclusionType}
                onChange={(e) =>
                  setNewExclusionType(e.target.value as typeof newExclusionType)
                }
              >
                {exclusionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {newExclusionType === "휴일지정" &&
                data.scheduler_type === "1730_timetable" && (
                  <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                      <div className="space-y-1 text-xs text-blue-800">
                        <div className="font-semibold">지정휴일 안내</div>
                        <div className="text-blue-700">
                          • 학습 분량은 배정되지 않습니다
                        </div>
                        <div className="text-blue-700">
                          • 자율 학습은 가능합니다 (설정된 시간대)
                        </div>
                        <div className="text-blue-700">
                          • 주차 계산에서 제외되어 7일 단위 학습 패턴에 영향을 주지 않습니다
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                사유 (선택사항)
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                placeholder="예: 가족 여행"
                value={newExclusionReason}
                onChange={(e) => setNewExclusionReason(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={addExclusion}
            disabled={
              !editable ||
              (exclusionInputType === "single" && !newExclusionDate) ||
              (exclusionInputType === "range" &&
                (!newExclusionStartDate || !newExclusionEndDate)) ||
              (exclusionInputType === "multiple" && newExclusionDates.length === 0)
            }
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            제외일 추가
          </button>
        </div>
      )}

      {/* 제외일 목록 */}
      {data.exclusions.length > 0 ? (
        <div className="space-y-2">
          {data.exclusions.map((exclusion, index) => (
            <div
              key={index}
              className={`rounded-lg border px-4 py-3 ${
                exclusion.exclusion_type === "휴일지정" &&
                data.scheduler_type === "1730_timetable"
                  ? "border-yellow-200 bg-yellow-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-900">
                      {exclusion.exclusion_date}
                    </div>
                    {exclusion.exclusion_type === "휴일지정" &&
                      data.scheduler_type === "1730_timetable" && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                          자율 학습 가능
                        </span>
                      )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <span>{exclusion.exclusion_type}</span>
                    {exclusion.reason && <span>· {exclusion.reason}</span>}
                    {exclusion.source === "template" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        <Lock className="h-3 w-3" />
                        템플릿
                      </span>
                    )}
                    {exclusion.source === "time_management" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                        <Clock className="h-3 w-3" />
                        시간 관리
                      </span>
                    )}
                    {exclusion.source === "student" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        <User className="h-3 w-3" />
                        직접 입력
                      </span>
                    )}
                  </div>
                  {exclusion.exclusion_type === "휴일지정" &&
                    data.scheduler_type === "1730_timetable" && (
                      <div className="mt-2 rounded border border-yellow-200 bg-white p-2 text-xs text-yellow-800">
                        <div className="font-medium">지정휴일 안내</div>
                        <div className="mt-1 text-yellow-700">
                          학습 분량은 배정되지 않지만, 자율 학습은 가능합니다.
                        </div>
                      </div>
                    )}
                </div>
                <button
                  type="button"
                  onClick={() => removeExclusion(index)}
                  disabled={
                    !editable ||
                    (campMode && (exclusion.is_locked || exclusion.source === "template"))
                  }
                  className={`ml-4 text-sm ${
                    !editable || (campMode && (exclusion.is_locked || exclusion.source === "template"))
                      ? "cursor-not-allowed text-gray-400"
                      : "text-red-600 hover:text-red-800"
                  }`}
                  title={
                    campMode && (exclusion.is_locked || exclusion.source === "template")
                      ? "템플릿에서 지정된 제외일은 삭제할 수 없습니다."
                      : "삭제"
                  }
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">등록된 제외일이 없습니다.</p>
      )}
      </div>
    </>
  );
});

