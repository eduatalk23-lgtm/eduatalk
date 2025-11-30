"use client";

import React, { useState, useMemo } from "react";
import { X, Clock, AlertCircle, AlertTriangle } from "lucide-react";
import {
  validateAcademyScheduleOverlap,
  getScheduleDescription,
} from "@/lib/validation/scheduleValidator";

type AcademySchedule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name?: string;
  subject?: string;
  travel_time?: number;
  source?: "template" | "student" | "time_management";
  is_locked?: boolean;
};

type AcademyScheduleImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  availableSchedules: AcademySchedule[];
  existingSchedules: AcademySchedule[];
  onImport: (selectedSchedules: AcademySchedule[]) => void;
};

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 학원 일정 선택 불러오기 모달
 * - 전체 학원 일정 목록 표시 (요일별 그룹화)
 * - 체크박스로 다중 선택
 * - 겹치는 시간대 경고 표시
 */
export function AcademyScheduleImportModal({
  isOpen,
  onClose,
  availableSchedules,
  existingSchedules,
  onImport,
}: AcademyScheduleImportModalProps) {
  const [selectedSchedules, setSelectedSchedules] = useState<Set<string>>(
    new Set()
  );

  // 일정을 고유하게 식별하기 위한 키 생성
  const getScheduleKey = (schedule: AcademySchedule): string => {
    return `${schedule.day_of_week}-${schedule.start_time}-${schedule.end_time}-${schedule.academy_name || ""}-${schedule.subject || ""}`;
  };

  // 기존 일정 키 Set
  const existingKeys = useMemo(() => {
    return new Set(existingSchedules.map(getScheduleKey));
  }, [existingSchedules]);

  // 새로 추가 가능한 일정
  const newSchedules = useMemo(() => {
    return availableSchedules.filter((s) => !existingKeys.has(getScheduleKey(s)));
  }, [availableSchedules, existingKeys]);

  // 요일별로 그룹화
  const groupedSchedules = useMemo(() => {
    const grouped: Record<number, AcademySchedule[]> = {};
    for (let i = 0; i < 7; i++) {
      grouped[i] = [];
    }
    availableSchedules.forEach((schedule) => {
      grouped[schedule.day_of_week].push(schedule);
    });
    return grouped;
  }, [availableSchedules]);

  // 선택된 일정들의 겹침 검증
  const conflictInfo = useMemo(() => {
    const selected = availableSchedules.filter((s) =>
      selectedSchedules.has(getScheduleKey(s))
    );
    const allSchedules = [...existingSchedules, ...selected];

    const conflicts = new Map<string, AcademySchedule[]>();

    selected.forEach((schedule) => {
      const validation = validateAcademyScheduleOverlap(schedule, allSchedules);
      if (!validation.isValid) {
        conflicts.set(getScheduleKey(schedule), validation.conflictSchedules);
      }
    });

    return conflicts;
  }, [selectedSchedules, availableSchedules, existingSchedules]);

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedSchedules.size === newSchedules.length) {
      setSelectedSchedules(new Set());
    } else {
      setSelectedSchedules(new Set(newSchedules.map(getScheduleKey)));
    }
  };

  // 개별 선택/해제
  const handleToggle = (schedule: AcademySchedule) => {
    const key = getScheduleKey(schedule);
    const newSet = new Set(selectedSchedules);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedSchedules(newSet);
  };

  // 등록 처리
  const handleImport = () => {
    if (conflictInfo.size > 0) {
      // 겹치는 일정이 있으면 경고
      return;
    }

    const selected = availableSchedules.filter((s) =>
      selectedSchedules.has(getScheduleKey(s))
    );
    onImport(selected);
    setSelectedSchedules(new Set());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">
              학원 일정 불러오기
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 내용 */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {/* 안내 메시지 */}
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
              <div className="text-xs text-blue-800">
                <p className="font-semibold">시간 관리에 등록된 학원 일정 목록입니다.</p>
                <p className="mt-1">
                  선택하여 등록하세요. 겹치는 시간대가 있으면 경고가 표시됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 겹침 경고 */}
          {conflictInfo.size > 0 && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                <div className="text-xs text-red-800">
                  <p className="font-semibold">
                    선택한 일정 중 {conflictInfo.size}개의 일정이 기존 일정과 겹칩니다.
                  </p>
                  <p className="mt-1">
                    겹치는 일정은 등록할 수 없습니다. 선택을 해제하거나 기존 일정을
                    수정해주세요.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 학원 일정 목록 */}
          {availableSchedules.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm font-medium text-gray-600">
                등록된 학원 일정이 없습니다
              </p>
              <p className="mt-1 text-xs text-gray-500">
                시간 관리 메뉴에서 학원 일정을 먼저 등록해주세요.
              </p>
            </div>
          ) : newSchedules.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm font-medium text-gray-600">
                불러올 새로운 학원 일정이 없습니다
              </p>
              <p className="mt-1 text-xs text-gray-500">
                모든 학원 일정이 이미 등록되어 있습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 전체 선택 */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3">
                <input
                  type="checkbox"
                  checked={selectedSchedules.size === newSchedules.length}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm font-medium text-gray-900">
                  전체 선택 ({selectedSchedules.size} / {newSchedules.length})
                </span>
              </div>

              {/* 요일별 그룹 */}
              {Object.entries(groupedSchedules).map(([dayOfWeek, schedules]) => {
                if (schedules.length === 0) return null;

                const day = Number(dayOfWeek);
                return (
                  <div key={day}>
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">
                      {weekdayLabels[day]}요일
                    </h3>
                    <div className="space-y-2">
                      {schedules.map((schedule) => {
                        const key = getScheduleKey(schedule);
                        const isExisting = existingKeys.has(key);
                        const isSelected = selectedSchedules.has(key);
                        const conflicts = conflictInfo.get(key);
                        const hasConflict = conflicts && conflicts.length > 0;

                        return (
                          <div
                            key={key}
                            className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                              isExisting
                                ? "border-gray-200 bg-gray-50 opacity-60"
                                : hasConflict
                                ? "border-red-300 bg-red-50"
                                : isSelected
                                ? "border-gray-900 bg-gray-50"
                                : "border-gray-200 bg-white hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggle(schedule)}
                              disabled={isExisting}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {schedule.start_time} ~ {schedule.end_time}
                                </span>
                                {isExisting && (
                                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                                    등록됨
                                  </span>
                                )}
                                {hasConflict && (
                                  <span className="rounded-full bg-red-200 px-2 py-0.5 text-xs font-medium text-red-800">
                                    시간 겹침
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-xs text-gray-600">
                                {schedule.academy_name && (
                                  <span className="font-medium">
                                    {schedule.academy_name}
                                  </span>
                                )}
                                {schedule.subject && (
                                  <span>
                                    {schedule.academy_name ? " - " : ""}
                                    {schedule.subject}
                                  </span>
                                )}
                                {schedule.travel_time && (
                                  <span className="ml-2 text-gray-500">
                                    이동시간: {schedule.travel_time}분
                                  </span>
                                )}
                              </div>
                              {hasConflict && (
                                <div className="mt-2 rounded border border-red-200 bg-white p-2 text-xs text-red-700">
                                  <p className="font-semibold">겹치는 일정:</p>
                                  {conflicts.map((conflictSchedule, idx) => (
                                    <p key={idx} className="mt-1">
                                      • {getScheduleDescription(conflictSchedule)}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <p className="text-sm text-gray-600">
            선택된 항목: <span className="font-semibold">{selectedSchedules.size}개</span>
            {conflictInfo.size > 0 && (
              <span className="ml-2 text-red-600">
                (겹침: {conflictInfo.size}개)
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedSchedules.size === 0 || conflictInfo.size > 0}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              선택 항목 등록
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

