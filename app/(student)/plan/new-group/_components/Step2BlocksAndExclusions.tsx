"use client";

import { useState } from "react";
import { Info, RefreshCw, Lock, Clock, User } from "lucide-react";
import { WizardData } from "./PlanGroupWizard";
import { TimeRangeInput } from "@/components/ui/TimeRangeInput";
import { useToast } from "@/components/ui/ToastProvider";
import {
  syncTimeManagementExclusionsAction,
  syncTimeManagementAcademySchedulesAction,
} from "@/app/(student)/actions/planGroupActions";

type Step2BlocksAndExclusionsProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  periodStart: string;
  periodEnd: string;
  groupId?: string; // 편집 모드일 때 플랜 그룹 ID
  onNavigateToStep?: (step: number) => void; // Step2로 이동하기 위한 콜백
  campMode?: boolean;
  isTemplateMode?: boolean; // 템플릿 모드 여부
  templateExclusions?: Array<{
    exclusion_date: string;
    exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
    reason?: string;
  }>;
  editable?: boolean; // 편집 가능 여부 (기본값: true)
  studentId?: string; // 관리자 모드일 때 학생 ID (선택적)
  isAdminMode?: boolean; // 관리자 모드 여부
  isAdminContinueMode?: boolean; // 관리자 남은 단계 진행 모드 여부
};

const weekdayLabels = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const exclusionTypes = [
  { value: "휴가", label: "휴가" },
  { value: "개인사정", label: "개인사정" },
  { value: "휴일지정", label: "휴일지정" },
  { value: "기타", label: "기타" },
] as const;

type ExclusionInputType = "single" | "range" | "multiple";

export function Step2BlocksAndExclusions({
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
  studentId,
  isAdminMode = false,
  isAdminContinueMode = false,
}: Step2BlocksAndExclusionsProps) {
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
  
  // 학생 모드에서 입력 가능 여부 확인
  const canStudentInputExclusions = campMode 
    ? (lockedFields.allow_student_exclusions !== false) // 기본값: true (허용)
    : true; // 일반 모드에서는 항상 허용
  
  const canStudentInputAcademySchedules = campMode
    ? (lockedFields.allow_student_academy_schedules !== false) // 기본값: true (허용)
    : true; // 일반 모드에서는 항상 허용
  
  const canStudentInputTimeSettings = campMode
    ? (lockedFields.allow_student_time_settings !== false) // 기본값: true (허용)
    : true; // 일반 모드에서는 항상 허용
  
  const canStudentInputNonStudyTimeBlocks = campMode
    ? (lockedFields.allow_student_non_study_time_blocks !== false) // 기본값: true (허용)
    : true; // 일반 모드에서는 항상 허용
  const [exclusionInputType, setExclusionInputType] = useState<ExclusionInputType>("single");
  const [newExclusionDate, setNewExclusionDate] = useState("");
  const [newExclusionStartDate, setNewExclusionStartDate] = useState("");
  const [newExclusionEndDate, setNewExclusionEndDate] = useState("");
  const [newExclusionDates, setNewExclusionDates] = useState<string[]>([]);
  const [newExclusionType, setNewExclusionType] = useState<"휴가" | "개인사정" | "휴일지정" | "기타">("휴가");
  const [newExclusionReason, setNewExclusionReason] = useState("");

  const [newAcademyDays, setNewAcademyDays] = useState<number[]>([]);
  const [newAcademyStartTime, setNewAcademyStartTime] = useState("09:00");
  const [newAcademyEndTime, setNewAcademyEndTime] = useState("10:00");
  const [newAcademyName, setNewAcademyName] = useState("");
  const [newAcademySubject, setNewAcademySubject] = useState("");
  const [newAcademyTravelTime, setNewAcademyTravelTime] = useState<number>(60); // 기본값: 60분 (1시간)

  // 시간 설정 접이식 상태
  const [isTimeSettingsOpen, setIsTimeSettingsOpen] = useState(false);
  
  // 학습 시간 제외 항목 상태
  const [isNonStudyTimeBlocksOpen, setIsNonStudyTimeBlocksOpen] = useState(false);
  const [newNonStudyTimeBlock, setNewNonStudyTimeBlock] = useState<{
    type: "아침식사" | "저녁식사" | "수면" | "기타"; // "점심식사" 제거
    start_time: string;
    end_time: string;
    day_of_week?: number[];
    description?: string;
  }>({
    type: "아침식사", // 기본값 변경
    start_time: "07:00",
    end_time: "08:00",
  });

  const toggleWeekday = (day: number) => {
    setNewAcademyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleExclusionDate = (date: string) => {
    setNewExclusionDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

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

    // 같은 사유의 학습 제외일로 추가
    // 템플릿 모드에서는 source: "template", is_locked: true
    // 일반 모드에서는 source: "student"
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
    
    // 권한별 삭제 가능 여부 확인
    // 템플릿은 캠프 모드에서만 사용되므로, 템플릿 제외일도 캠프 모드에서만 존재
    // - isTemplateMode (관리자 템플릿 생성/수정): 모든 제외일 삭제 가능
    // - campMode (학생 캠프 참여 입력): 템플릿 제외일 삭제 불가
    // - 일반 모드: 템플릿 제외일이 존재하지 않으므로 항상 삭제 가능
    const isTemplateExclusion = exclusion.is_locked || exclusion.source === "template";
    
    // campMode일 때만 템플릿 제외일 삭제 불가
    if (campMode && isTemplateExclusion) {
      toast.showError("템플릿에서 지정된 제외일은 삭제할 수 없습니다.");
      return;
    }
    
    onUpdate({
      exclusions: data.exclusions.filter((_, i) => i !== index),
    });
  };

  const addAcademySchedule = () => {
    if (newAcademyDays.length === 0) {
      toast.showError("요일을 최소 1개 이상 선택해주세요.");
      return;
    }
    if (!newAcademyStartTime || !newAcademyEndTime) {
      toast.showError("시작 시간과 종료 시간을 입력해주세요.");
      return;
    }
    if (!newAcademyName.trim()) {
      toast.showError("학원 이름을 입력해주세요.");
      return;
    }
    if (!newAcademySubject.trim()) {
      toast.showError("과목을 입력해주세요.");
      return;
    }
    if (!newAcademyTravelTime || newAcademyTravelTime <= 0) {
      toast.showError("이동시간을 입력해주세요. (최소 1분 이상)");
      return;
    }

    // 선택된 요일마다 일정 추가
    // 템플릿 모드에서는 source: "template", is_locked: true
    // 일반 모드에서는 source: "student"
    const newSchedules = newAcademyDays.map((day) => ({
      day_of_week: day,
      start_time: newAcademyStartTime,
      end_time: newAcademyEndTime,
      academy_name: newAcademyName.trim(),
      subject: newAcademySubject.trim(),
      travel_time: newAcademyTravelTime || 60, // 기본값: 60분
      source: isTemplateMode ? ("template" as const) : ("student" as const),
      is_locked: isTemplateMode ? true : undefined,
    }));

    onUpdate({
      academy_schedules: [...data.academy_schedules, ...newSchedules],
    });

    // 폼 초기화
    setNewAcademyDays([]);
    setNewAcademyStartTime("09:00");
    setNewAcademyEndTime("10:00");
    setNewAcademyName("");
    setNewAcademySubject("");
    setNewAcademyTravelTime(60);
  };

  const removeAcademySchedule = (index: number) => {
    const schedule = data.academy_schedules[index];
    
    // 권한별 삭제 가능 여부 확인
    // 템플릿은 캠프 모드에서만 사용되므로, 템플릿 학원 일정도 캠프 모드에서만 존재
    // - isTemplateMode (관리자 템플릿 생성/수정): 모든 학원 일정 삭제 가능
    // - campMode (학생 캠프 참여 입력): 템플릿 학원 일정 삭제 불가
    // - 일반 모드: 템플릿 학원 일정이 존재하지 않으므로 항상 삭제 가능
    const isTemplateSchedule = schedule.is_locked || schedule.source === "template";
    
    // campMode일 때만 템플릿 학원 일정 삭제 불가
    if (campMode && isTemplateSchedule) {
      toast.showError("템플릿에서 지정된 학원 일정은 삭제할 수 없습니다.");
      return;
    }
    
    onUpdate({
      academy_schedules: data.academy_schedules.filter((_, i) => i !== index),
    });
  };

  const updateTimeSetting = (
    key: "lunch_time" | "camp_study_hours" | "camp_self_study_hours" | "designated_holiday_hours",
    range: { start: string; end: string } | undefined
  ) => {
    onUpdate({
      time_settings: {
        ...data.time_settings,
        [key]: range,
      },
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">블록 및 제외일 설정</h2>
        <p className="mt-1 text-sm text-gray-500">
          학습 제외일과 학원 일정을 설정해주세요. 블록은 기간 설정에서 선택한 블록 세트를 사용합니다.
        </p>
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 text-blue-600" />
            <div className="text-xs text-blue-800">
              <p className="font-semibold">학원 일정과 제외일은 학생별로 전역 관리됩니다.</p>
              <p className="mt-1">
                입력한 학원 일정과 제외일은 모든 플랜 그룹에서 공유되며, 중복 입력 시 자동으로 제외됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 학습 제외일 */}
      <div>
        <div className="mb-3 flex items-center justify-between">
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
          <button
            type="button"
            onClick={async () => {
              try {
                const result = await syncTimeManagementExclusionsAction(
                  groupId || null,
                  periodStart,
                  periodEnd
                );
                
                if (result.exclusions && result.exclusions.length > 0) {
                  // 기존 제외일과 병합 (중복 제거)
                  const existingDates = new Set(data.exclusions.map((e) => e.exclusion_date));
                  const newExclusions = result.exclusions
                    .filter((e) => !existingDates.has(e.exclusion_date))
                    .map((e) => ({ ...e, source: "time_management" as const }));
                  
                  onUpdate({
                    exclusions: [...data.exclusions, ...newExclusions],
                  });
                  
                  // Step2로 이동하여 변경사항 확인 (다른 Step에서 호출된 경우)
                  if (onNavigateToStep) {
                    onNavigateToStep(2);
                  }
                  
                  toast.showSuccess(`시간 관리에서 ${newExclusions.length}개의 제외일을 불러왔습니다.`);
                } else {
                  toast.showInfo("불러올 새로운 제외일이 없습니다.");
                }
              } catch (error) {
                toast.showError(
                  error instanceof Error
                    ? error.message
                    : "제외일 불러오기에 실패했습니다."
                );
              }
            }}
            disabled={!editable}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            시간 관리에서 불러오기
          </button>
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
              {/* 지정휴일 선택 시 안내 문구 (1730 Timetable만) */}
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

      {/* 학원 일정 */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">학원 일정</h3>
            {isTemplateMode && (
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={lockedFields.allow_student_academy_schedules === true}
                  onChange={() => toggleFieldControl("allow_student_academy_schedules")}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span>학생 입력 허용</span>
              </label>
            )}
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                // 관리자 모드일 때는 studentId 전달
                const targetStudentId = (isAdminMode || isAdminContinueMode) ? studentId : undefined;
                const result = await syncTimeManagementAcademySchedulesAction(groupId || null, targetStudentId);
                
                if (result.academySchedules && result.academySchedules.length > 0) {
                  // 기존 학원 일정과 병합 (중복 제거 - 요일+시간 기준)
                  const existingKeys = new Set(
                    data.academy_schedules.map(
                      (s) => `${s.day_of_week}-${s.start_time}-${s.end_time}`
                    )
                  );
                  const newSchedules = result.academySchedules
                    .filter(
                      (s) =>
                        !existingKeys.has(`${s.day_of_week}-${s.start_time}-${s.end_time}`)
                    )
                    .map((s) => ({ ...s, source: "time_management" as const }));
                  
                  onUpdate({
                    academy_schedules: [...data.academy_schedules, ...newSchedules],
                  });
                  
                  // Step2로 이동하여 변경사항 확인 (다른 Step에서 호출된 경우)
                  if (onNavigateToStep) {
                    onNavigateToStep(2);
                  }
                  
                  toast.showSuccess(`시간 관리에서 ${newSchedules.length}개의 학원 일정을 불러왔습니다.`);
                } else {
                  toast.showInfo("불러올 새로운 학원 일정이 없습니다.");
                }
              } catch (error) {
                toast.showError(
                  error instanceof Error
                    ? error.message
                    : "학원 일정 불러오기에 실패했습니다."
                );
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-3 w-3" />
            시간 관리에서 불러오기
          </button>
        </div>

        {/* 학원 일정 추가 폼 */}
        {editable && (!campMode || canStudentInputAcademySchedules) && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-gray-700">
              요일 선택 (다중 선택 가능) <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {weekdayLabels.map((label, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggleWeekday(index)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    newAcademyDays.includes(index)
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {newAcademyDays.length > 0 && (
              <p className="mt-2 text-xs text-gray-600">
                {newAcademyDays.length}개 요일 선택됨
              </p>
            )}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                시작 시간 <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                value={newAcademyStartTime}
                onChange={(e) => setNewAcademyStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                종료 시간 <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                value={newAcademyEndTime}
                onChange={(e) => setNewAcademyEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                학원 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                placeholder="예: 수학 학원"
                value={newAcademyName}
                onChange={(e) => setNewAcademyName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                과목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                placeholder="예: 수학"
                value={newAcademySubject}
                onChange={(e) => setNewAcademySubject(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              이동시간 (분) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="300"
                step="15"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                placeholder="60"
                value={newAcademyTravelTime}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setNewAcademyTravelTime(Math.max(0, Math.min(300, value)));
                }}
              />
              <span className="text-xs text-gray-500">분</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              블록 시간 내 학원 일정이 있는 경우, 학원 전후로 이동시간을 자동으로 제외합니다. (기본값: 60분)
            </p>
          </div>

          <button
            type="button"
            onClick={addAcademySchedule}
            disabled={
              !editable ||
              newAcademyDays.length === 0 ||
              !newAcademyStartTime ||
              !newAcademyEndTime ||
              !newAcademyName.trim() ||
              !newAcademySubject.trim() ||
              !newAcademyTravelTime ||
              newAcademyTravelTime <= 0
            }
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            학원 일정 추가
          </button>
        </div>
        )}

        {/* 학원 일정 목록 */}
        {data.academy_schedules.length > 0 ? (
          <div className="space-y-2">
            {data.academy_schedules.map((schedule, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {weekdayLabels[schedule.day_of_week]} {schedule.start_time} ~ {schedule.end_time}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    {schedule.academy_name && <span>{schedule.academy_name}</span>}
                    {schedule.subject && <span>· {schedule.subject}</span>}
                    <span>· 이동시간: {schedule.travel_time || 60}분</span>
                    {schedule.source === "template" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        <Lock className="h-3 w-3" />
                        템플릿
                      </span>
                    )}
                    {schedule.source === "time_management" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                        <Clock className="h-3 w-3" />
                        시간 관리
                      </span>
                    )}
                    {schedule.source === "student" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        <User className="h-3 w-3" />
                        직접 입력
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAcademySchedule(index)}
                  disabled={
                    !editable ||
                    (campMode && (schedule.is_locked || schedule.source === "template"))
                  }
                  className={`ml-4 text-sm ${
                    !editable || (campMode && (schedule.is_locked || schedule.source === "template"))
                      ? "cursor-not-allowed text-gray-400"
                      : "text-red-600 hover:text-red-800"
                  }`}
                  title={
                    campMode && (schedule.is_locked || schedule.source === "template")
                      ? "템플릿에서 지정된 학원 일정은 삭제할 수 없습니다."
                      : "삭제"
                  }
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">등록된 학원 일정이 없습니다.</p>
        )}
      </div>

      {/* 시간 설정 */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsTimeSettingsOpen(!isTimeSettingsOpen)}
            className="flex flex-1 items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
          >
            <div>
              <h3 className="text-sm font-semibold text-gray-900">시간 설정</h3>
              <p className="mt-1 text-xs text-gray-500">
                점심시간 및 학습 시간대를 조정할 수 있습니다.
              </p>
            </div>
            <span className="text-gray-400">
              {isTimeSettingsOpen ? "▲" : "▼"}
            </span>
          </button>
          {isTemplateMode && (
            <label className="ml-3 flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={lockedFields.allow_student_time_settings === true}
                onChange={() => toggleFieldControl("allow_student_time_settings")}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span>학생 입력 허용</span>
            </label>
          )}
        </div>

        {isTimeSettingsOpen && (
          <div className="mt-4 space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            {/* 점심시간 */}
            {(!campMode || canStudentInputTimeSettings) && (
              <TimeRangeInput
                label="점심시간"
                description="모든 학습일에서 제외할 점심 시간대"
                value={data.time_settings?.lunch_time}
                onChange={(range) => updateTimeSetting("lunch_time", range)}
                defaultStart="12:00"
                defaultEnd="13:00"
              />
            )}

            {/* 자율학습 시간 배정 토글 */}
            {(!campMode || canStudentInputTimeSettings) && (
            <div className="space-y-3">
              {/* 지정휴일 자율학습 시간 배정하기 토글 */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
                <input
                  type="checkbox"
                  id="enable_self_study_for_holidays"
                  checked={data.time_settings?.enable_self_study_for_holidays ?? false}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    onUpdate({
                      time_settings: {
                        ...data.time_settings,
                        enable_self_study_for_holidays: enabled,
                        // 토글이 켜지면 기본 시간 설정, 꺼지면 undefined
                        designated_holiday_hours: enabled
                          ? data.time_settings?.designated_holiday_hours || { start: "13:00", end: "19:00" }
                          : undefined,
                      },
                    });
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <label
                  htmlFor="enable_self_study_for_holidays"
                  className="flex-1 cursor-pointer text-sm text-gray-700"
                >
                  <div className="font-medium">지정휴일 자율학습 시간 배정하기</div>
                  <div className="mt-1 text-xs text-gray-500">
                    지정휴일에 자율학습 시간을 배정합니다.
                  </div>
                </label>
              </div>

              {/* 지정휴일 시간 설정 (토글이 켜져있을 때만 표시) */}
              {data.time_settings?.enable_self_study_for_holidays && (
                <div className="ml-7">
                  <TimeRangeInput
                    label="지정휴일 자율학습 시간"
                    description="지정휴일의 자율학습 시간대"
                    value={data.time_settings?.designated_holiday_hours}
                    onChange={(range) => updateTimeSetting("designated_holiday_hours", range)}
                    defaultStart="13:00"
                    defaultEnd="19:00"
                  />
                </div>
              )}

              {/* 학습일/복습일 자율학습 시간 배정하기 토글 */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
                <input
                  type="checkbox"
                  id="enable_self_study_for_study_days"
                  checked={data.time_settings?.enable_self_study_for_study_days ?? false}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    onUpdate({
                      time_settings: {
                        ...data.time_settings,
                        enable_self_study_for_study_days: enabled,
                        // 토글이 켜지면 기본 시간 설정, 꺼지면 undefined
                        camp_self_study_hours: enabled
                          ? data.time_settings?.camp_self_study_hours || { start: "19:00", end: "22:00" }
                          : undefined,
                        // 토글이 켜지면 기존 자율학습시간 사용 가능 설정 활성화
                        use_self_study_with_blocks: enabled ? true : undefined,
                      },
                    });
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <label
                  htmlFor="enable_self_study_for_study_days"
                  className="flex-1 cursor-pointer text-sm text-gray-700"
                >
                  <div className="font-medium">학습일/복습일 자율학습 시간 배정하기</div>
                  <div className="mt-1 text-xs text-gray-500">
                    학습일과 복습일에 자율학습 시간을 배정합니다. 시간블록이 있어도 자율학습 시간을 함께 사용할 수 있습니다.
                  </div>
                </label>
              </div>

              {/* 학습일/복습일 시간 설정 (토글이 켜져있을 때만 표시) */}
              {data.time_settings?.enable_self_study_for_study_days && (
                <div className="ml-7">
                  <TimeRangeInput
                    label="학습일/복습일 자율학습 시간"
                    description="학습일과 복습일의 자율학습 시간대"
                    value={data.time_settings?.camp_self_study_hours}
                    onChange={(range) => updateTimeSetting("camp_self_study_hours", range)}
                    defaultStart="19:00"
                    defaultEnd="22:00"
                  />
                </div>
              )}
            </div>
            )}
          </div>
        )}

        {/* 학습 시간 제외 항목 설정 */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">학습 시간 제외 항목</h3>
              {isTemplateMode && (
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={lockedFields.allow_student_non_study_time_blocks === true}
                    onChange={() => toggleFieldControl("allow_student_non_study_time_blocks")}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span>학생 입력 허용</span>
                </label>
              )}
              <Info className="h-4 w-4 text-gray-400" />
            </div>
            <button
              type="button"
              onClick={() => setIsNonStudyTimeBlocksOpen(!isNonStudyTimeBlocksOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <span className="text-gray-400">{isNonStudyTimeBlocksOpen ? "▲" : "▼"}</span>
            </button>
          </div>

          {isNonStudyTimeBlocksOpen && (
            <div className="border-t border-gray-200 p-4">
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
                        onClick={() => {
                          const updated = [...(data.non_study_time_blocks || [])];
                          updated.splice(index, 1);
                          onUpdate({ non_study_time_blocks: updated.length > 0 ? updated : undefined });
                        }}
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
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
                        onClick={() => {
                          const currentDays = newNonStudyTimeBlock.day_of_week || [];
                          const updatedDays = currentDays.includes(day)
                            ? currentDays.filter((d) => d !== day)
                            : [...currentDays, day];
                          setNewNonStudyTimeBlock({
                            ...newNonStudyTimeBlock,
                            day_of_week: updatedDays.length > 0 ? updatedDays : undefined,
                          });
                        }}
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
                  onClick={() => {
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
                    setNewNonStudyTimeBlock({
                      type: "아침식사",
                      start_time: "07:00",
                      end_time: "08:00",
                    });
                  }}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  제외 항목 추가
                </button>
              </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

