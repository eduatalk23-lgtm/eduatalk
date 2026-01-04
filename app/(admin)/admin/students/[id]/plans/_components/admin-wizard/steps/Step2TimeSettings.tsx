"use client";

/**
 * Step 2: 시간 설정
 *
 * Phase 3: 7단계 위저드 확장
 * - 스케줄러 타입 선택
 * - 학원 스케줄 연동
 * - 제외 일정 설정
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step2TimeSettings
 */

import { useCallback, useState } from "react";
import { Clock, Calendar, Plus, X, Building2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useAdminWizardData,
  useAdminWizardValidation,
  useAdminWizardStep,
} from "../_context";
import type { ExclusionSchedule, AcademySchedule } from "../_context/types";

/**
 * Step2TimeSettings Props
 */
interface Step2TimeSettingsProps {
  studentId: string;
  editable?: boolean;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const SCHEDULER_TYPES = [
  {
    value: "1730_timetable",
    label: "1730 시간표",
    description: "표준 학습 시간표 적용",
  },
  {
    value: "custom",
    label: "맞춤 설정",
    description: "학원/개인 스케줄 직접 설정",
  },
];

const EXCLUSION_TYPES = [
  { value: "holiday", label: "휴일" },
  { value: "event", label: "행사" },
  { value: "personal", label: "개인" },
] as const;

/**
 * Step 2: 시간 설정 컴포넌트
 */
export function Step2TimeSettings({
  studentId,
  editable = true,
}: Step2TimeSettingsProps) {
  const { wizardData, updateData } = useAdminWizardData();
  const { setFieldError, clearFieldError } = useAdminWizardValidation();
  const { prevStep } = useAdminWizardStep();

  const {
    schedulerType,
    academySchedules,
    exclusions,
    periodStart,
    periodEnd,
  } = wizardData;

  // 새 제외일/학원 스케줄 입력 상태
  const [newExclusion, setNewExclusion] = useState<Partial<ExclusionSchedule>>({
    exclusion_date: "",
    exclusion_type: "personal",
    reason: "",
  });

  const [newAcademy, setNewAcademy] = useState<Partial<AcademySchedule>>({
    day_of_week: 1,
    start_time: "18:00",
    end_time: "21:00",
    academy_name: "",
    subject: "",
  });

  const [showAddExclusion, setShowAddExclusion] = useState(false);
  const [showAddAcademy, setShowAddAcademy] = useState(false);

  // 스케줄러 타입 변경
  const handleSchedulerTypeChange = useCallback(
    (type: "1730_timetable" | "custom" | "") => {
      updateData({ schedulerType: type });
    },
    [updateData]
  );

  // 제외일 추가
  const handleAddExclusion = useCallback(() => {
    if (!newExclusion.exclusion_date) {
      setFieldError("exclusion", "날짜를 선택해주세요.");
      return;
    }

    // 기간 내 날짜인지 확인
    if (periodStart && periodEnd) {
      const date = new Date(newExclusion.exclusion_date);
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      if (date < start || date > end) {
        setFieldError("exclusion", "학습 기간 내의 날짜를 선택해주세요.");
        return;
      }
    }

    // 중복 확인
    const isDuplicate = exclusions.some(
      (e) => e.exclusion_date === newExclusion.exclusion_date
    );
    if (isDuplicate) {
      setFieldError("exclusion", "이미 추가된 날짜입니다.");
      return;
    }

    updateData({
      exclusions: [
        ...exclusions,
        {
          exclusion_date: newExclusion.exclusion_date,
          exclusion_type: newExclusion.exclusion_type || "personal",
          reason: newExclusion.reason,
          source: "manual",
        },
      ],
    });

    setNewExclusion({
      exclusion_date: "",
      exclusion_type: "personal",
      reason: "",
    });
    setShowAddExclusion(false);
    clearFieldError("exclusion");
  }, [newExclusion, exclusions, periodStart, periodEnd, updateData, setFieldError, clearFieldError]);

  // 제외일 삭제
  const handleRemoveExclusion = useCallback(
    (index: number) => {
      updateData({
        exclusions: exclusions.filter((_, i) => i !== index),
      });
    },
    [exclusions, updateData]
  );

  // 학원 스케줄 추가
  const handleAddAcademy = useCallback(() => {
    if (!newAcademy.start_time || !newAcademy.end_time) {
      setFieldError("academy", "시간을 입력해주세요.");
      return;
    }

    updateData({
      academySchedules: [
        ...academySchedules,
        {
          day_of_week: newAcademy.day_of_week ?? 1,
          start_time: newAcademy.start_time,
          end_time: newAcademy.end_time,
          academy_name: newAcademy.academy_name,
          subject: newAcademy.subject,
          source: "manual",
        },
      ],
    });

    setNewAcademy({
      day_of_week: 1,
      start_time: "18:00",
      end_time: "21:00",
      academy_name: "",
      subject: "",
    });
    setShowAddAcademy(false);
    clearFieldError("academy");
  }, [newAcademy, academySchedules, updateData, setFieldError, clearFieldError]);

  // 학원 스케줄 삭제
  const handleRemoveAcademy = useCallback(
    (index: number) => {
      updateData({
        academySchedules: academySchedules.filter((_, i) => i !== index),
      });
    },
    [academySchedules, updateData]
  );

  return (
    <div className="space-y-6">
      {/* 스케줄러 타입 선택 */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Clock className="h-4 w-4" />
          스케줄러 타입
        </label>
        <div className="grid grid-cols-2 gap-3">
          {SCHEDULER_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() =>
                handleSchedulerTypeChange(
                  type.value as "1730_timetable" | "custom"
                )
              }
              disabled={!editable}
              data-testid={`scheduler-type-${type.value}`}
              className={cn(
                "flex flex-col items-start rounded-lg border p-4 text-left transition",
                schedulerType === type.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300",
                !editable && "cursor-not-allowed opacity-50"
              )}
            >
              <span
                className={cn(
                  "font-medium",
                  schedulerType === type.value
                    ? "text-blue-700"
                    : "text-gray-900"
                )}
              >
                {type.label}
              </span>
              <span className="mt-1 text-xs text-gray-500">
                {type.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 학원 스케줄 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Building2 className="h-4 w-4" />
            학원 스케줄 <span className="text-xs text-gray-400">(선택)</span>
          </label>
          {editable && (
            <button
              type="button"
              onClick={() => setShowAddAcademy(true)}
              data-testid="add-academy-button"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-4 w-4" />
              추가
            </button>
          )}
        </div>

        {/* 학원 스케줄 목록 */}
        {academySchedules.length > 0 ? (
          <div className="space-y-2">
            {academySchedules.map((schedule, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {WEEKDAYS[schedule.day_of_week]}
                  </span>
                  <span className="text-sm text-gray-700">
                    {schedule.start_time.slice(0, 5)} -{" "}
                    {schedule.end_time.slice(0, 5)}
                  </span>
                  {schedule.academy_name && (
                    <span className="text-sm text-gray-500">
                      {schedule.academy_name}
                    </span>
                  )}
                </div>
                {editable && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAcademy(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-4 text-center text-sm text-gray-500">
            등록된 학원 스케줄이 없습니다.
          </div>
        )}

        {/* 학원 스케줄 추가 폼 */}
        {showAddAcademy && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-600">요일</label>
                <select
                  value={newAcademy.day_of_week}
                  onChange={(e) =>
                    setNewAcademy({ ...newAcademy, day_of_week: Number(e.target.value) })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {WEEKDAYS.map((day, i) => (
                    <option key={i} value={i}>
                      {day}요일
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">학원명</label>
                <input
                  type="text"
                  value={newAcademy.academy_name || ""}
                  onChange={(e) =>
                    setNewAcademy({ ...newAcademy, academy_name: e.target.value })
                  }
                  placeholder="학원명 (선택)"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">시작 시간</label>
                <input
                  type="time"
                  value={newAcademy.start_time}
                  onChange={(e) =>
                    setNewAcademy({ ...newAcademy, start_time: e.target.value })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">종료 시간</label>
                <input
                  type="time"
                  value={newAcademy.end_time}
                  onChange={(e) =>
                    setNewAcademy({ ...newAcademy, end_time: e.target.value })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddAcademy(false)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddAcademy}
                data-testid="confirm-add-academy"
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 제외 일정 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4" />
            제외 일정 <span className="text-xs text-gray-400">(선택)</span>
          </label>
          {editable && (
            <button
              type="button"
              onClick={() => setShowAddExclusion(true)}
              data-testid="add-exclusion-button"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-4 w-4" />
              추가
            </button>
          )}
        </div>

        {/* 제외일 목록 */}
        {exclusions.length > 0 ? (
          <div className="space-y-2">
            {exclusions.map((exc, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    {exc.exclusion_date}
                  </span>
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-xs font-medium",
                      exc.exclusion_type === "holiday"
                        ? "bg-red-100 text-red-700"
                        : exc.exclusion_type === "event"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                    )}
                  >
                    {EXCLUSION_TYPES.find((t) => t.value === exc.exclusion_type)?.label ||
                      exc.exclusion_type}
                  </span>
                  {exc.reason && (
                    <span className="text-sm text-gray-500">{exc.reason}</span>
                  )}
                </div>
                {editable && !exc.is_locked && (
                  <button
                    type="button"
                    onClick={() => handleRemoveExclusion(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-4 text-center text-sm text-gray-500">
            등록된 제외 일정이 없습니다.
          </div>
        )}

        {/* 제외일 추가 폼 */}
        {showAddExclusion && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-600">날짜</label>
                <input
                  type="date"
                  value={newExclusion.exclusion_date}
                  min={periodStart}
                  max={periodEnd}
                  onChange={(e) =>
                    setNewExclusion({ ...newExclusion, exclusion_date: e.target.value })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">유형</label>
                <select
                  value={newExclusion.exclusion_type}
                  onChange={(e) =>
                    setNewExclusion({
                      ...newExclusion,
                      exclusion_type: e.target.value as ExclusionSchedule["exclusion_type"],
                    })
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {EXCLUSION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-600">사유</label>
                <input
                  type="text"
                  value={newExclusion.reason || ""}
                  onChange={(e) =>
                    setNewExclusion({ ...newExclusion, reason: e.target.value })
                  }
                  placeholder="사유 (선택)"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddExclusion(false)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddExclusion}
                data-testid="confirm-add-exclusion"
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">시간 설정 안내</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-blue-700">
            <li>학원 스케줄이 있는 시간대는 학습 시간에서 자동으로 제외됩니다.</li>
            <li>제외 일정은 해당 날짜 전체가 학습에서 제외됩니다.</li>
            <li>다음 단계에서 설정된 스케줄을 미리 확인할 수 있습니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
