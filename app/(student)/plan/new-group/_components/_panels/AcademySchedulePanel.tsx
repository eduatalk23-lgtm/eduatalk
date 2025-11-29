"use client";

import React, { useState } from "react";
import { RefreshCw, Lock, Clock, User } from "lucide-react";
import { WizardData } from "../PlanGroupWizard";
import { useToast } from "@/components/ui/ToastProvider";
import { syncTimeManagementAcademySchedulesAction } from "@/app/(student)/actions/planGroupActions";

type AcademySchedulePanelProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  groupId?: string;
  campMode?: boolean;
  isTemplateMode?: boolean;
  editable?: boolean;
  studentId?: string;
  isAdminMode?: boolean;
  isAdminContinueMode?: boolean;
};

const weekdayLabels = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

/**
 * 학원 일정 관리 패널
 * - 요일별 학원 일정 추가
 * - 시간 관리에서 불러오기
 * - 템플릿 학원 일정 관리
 */
export const AcademySchedulePanel = React.memo(function AcademySchedulePanel({
  data,
  onUpdate,
  groupId,
  campMode = false,
  isTemplateMode = false,
  editable = true,
  studentId,
  isAdminMode = false,
  isAdminContinueMode = false,
}: AcademySchedulePanelProps) {
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
  const canStudentInputAcademySchedules = campMode
    ? (lockedFields.allow_student_academy_schedules !== false)
    : true;

  // 로컬 상태
  const [newAcademyDays, setNewAcademyDays] = useState<number[]>([]);
  const [newAcademyStartTime, setNewAcademyStartTime] = useState("09:00");
  const [newAcademyEndTime, setNewAcademyEndTime] = useState("10:00");
  const [newAcademyName, setNewAcademyName] = useState("");
  const [newAcademySubject, setNewAcademySubject] = useState("");
  const [newAcademyTravelTime, setNewAcademyTravelTime] = useState<number>(60);

  const toggleWeekday = (day: number) => {
    setNewAcademyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
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
    const newSchedules = newAcademyDays.map((day) => ({
      day_of_week: day,
      start_time: newAcademyStartTime,
      end_time: newAcademyEndTime,
      academy_name: newAcademyName.trim(),
      subject: newAcademySubject.trim(),
      travel_time: newAcademyTravelTime || 60,
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
    const isTemplateSchedule = schedule.is_locked || schedule.source === "template";
    
    if (campMode && isTemplateSchedule) {
      toast.showError("템플릿에서 지정된 학원 일정은 삭제할 수 없습니다.");
      return;
    }
    
    onUpdate({
      academy_schedules: data.academy_schedules.filter((_, i) => i !== index),
    });
  };

  const syncFromTimeManagement = async () => {
    try {
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
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between">
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
          onClick={syncFromTimeManagement}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-3 w-3" />
          시간 관리에서 불러오기
        </button>
      </div>

      {/* 학원 일정 추가 폼 */}
      {editable && (!campMode || canStudentInputAcademySchedules) && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {/* 요일 선택 */}
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

          {/* 시간 설정 */}
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

          {/* 학원 정보 */}
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

          {/* 이동시간 */}
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
  );
});

