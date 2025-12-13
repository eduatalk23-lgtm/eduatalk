"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Clock, AlertCircle, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import {
  validateAcademyScheduleOverlap,
  getScheduleDescription,
} from "@/lib/validation/scheduleValidator";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";

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
  const [expandedAcademies, setExpandedAcademies] = useState<Set<string>>(
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

  // 학원별로 그룹화
  const groupedByAcademy = useMemo(() => {
    const grouped: Record<string, AcademySchedule[]> = {};
    availableSchedules.forEach((schedule) => {
      const academyKey = schedule.academy_name || "기타";
      if (!grouped[academyKey]) {
        grouped[academyKey] = [];
      }
      grouped[academyKey].push(schedule);
    });
    return grouped;
  }, [availableSchedules]);

  // 선택된 일정들의 겹침 검증
  const conflictInfo = useMemo(() => {
    const selected = availableSchedules.filter((s) =>
      selectedSchedules.has(getScheduleKey(s))
    );

    const conflicts = new Map<string, AcademySchedule[]>();

    selected.forEach((schedule) => {
      // 자기 자신을 제외한 일정 목록으로 검증
      const otherSchedules = [
        ...existingSchedules,
        ...selected.filter((s) => getScheduleKey(s) !== getScheduleKey(schedule))
      ];
      
      const validation = validateAcademyScheduleOverlap(schedule, otherSchedules);
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

  // 학원 접힘/펼침 토글
  const toggleAcademy = (academyName: string) => {
    const newSet = new Set(expandedAcademies);
    if (newSet.has(academyName)) {
      newSet.delete(academyName);
    } else {
      newSet.add(academyName);
    }
    setExpandedAcademies(newSet);
  };

  // 학원 전체 선택/해제
  const handleSelectAcademy = (academyName: string) => {
    const academySchedules = groupedByAcademy[academyName] || [];
    
    // 기존 일정과 중복되지 않는 항목만 필터링
    const selectableSchedules = academySchedules.filter(
      (s) => !existingKeys.has(getScheduleKey(s))
    );
    
    if (selectableSchedules.length === 0) return;
    
    const allSelected = selectableSchedules.every((s) =>
      selectedSchedules.has(getScheduleKey(s))
    );

    const newSet = new Set(selectedSchedules);
    if (allSelected) {
      // 모두 선택되어 있으면 해제
      selectableSchedules.forEach((s) => newSet.delete(getScheduleKey(s)));
    } else {
      // 일부만 선택되어 있거나 모두 해제되어 있으면 선택
      selectableSchedules.forEach((s) => newSet.add(getScheduleKey(s)));
    }
    setSelectedSchedules(newSet);
  };

  // 첫 번째 학원 기본 펼침
  useEffect(() => {
    if (Object.keys(groupedByAcademy).length > 0 && expandedAcademies.size === 0) {
      const firstAcademy = Object.keys(groupedByAcademy)[0];
      setExpandedAcademies(new Set([firstAcademy]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedByAcademy]);

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

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
      title="학원 일정 불러오기"
      maxWidth="4xl"
    >
      <DialogContent className="max-h-[60vh] overflow-y-auto">
          <div className="flex flex-col gap-4">
            {/* 안내 메시지 */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-blue-600" />
                <div className="flex flex-col gap-1 text-xs text-blue-800">
                  <p className="font-semibold">시간 관리에 등록된 학원 일정 목록입니다.</p>
                  <p>
                    선택하여 등록하세요. 겹치는 시간대가 있으면 경고가 표시됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 선택 요약 정보 */}
            {selectedSchedules.size > 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-green-600" />
                    <div className="flex flex-col gap-1 text-xs text-green-800">
                      <p className="font-semibold">
                        {selectedSchedules.size}개 일정 선택됨
                      </p>
                      {Object.keys(groupedByAcademy).length > 0 && (
                        <p>
                          {Object.entries(groupedByAcademy).filter(([name, schedules]) => 
                            schedules.some(s => selectedSchedules.has(getScheduleKey(s)) && !existingKeys.has(getScheduleKey(s)))
                          ).length}개 학원에서 선택
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 겹침 경고 */}
            {conflictInfo.size > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
                  <div className="flex flex-col gap-1 text-xs text-red-800">
                    <p className="font-semibold">
                      선택한 일정 중 {conflictInfo.size}개의 일정이 기존 일정과 겹칩니다.
                    </p>
                    <p>
                      겹치는 일정은 등록할 수 없습니다. 선택을 해제하거나 기존 일정을
                      수정해주세요.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 학원 일정 목록 */}
            {availableSchedules.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Clock className="h-12 w-12 text-gray-400" />
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-gray-600">
                      등록된 학원 일정이 없습니다
                    </p>
                    <p className="text-xs text-gray-500">
                      시간 관리 메뉴에서 학원 일정을 먼저 등록해주세요.
                    </p>
                  </div>
                </div>
              </div>
            ) : newSchedules.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8">
                <div className="flex flex-col items-center gap-2 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-400" />
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-gray-600">
                      불러올 새로운 학원 일정이 없습니다
                    </p>
                    <p className="text-xs text-gray-500">
                      모든 학원 일정이 이미 등록되어 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
              {/* 전체 선택 및 모두 펼치기/접기 */}
              <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 p-3">
                <div className="flex items-center gap-2">
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
                {Object.keys(groupedByAcademy).length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (expandedAcademies.size === Object.keys(groupedByAcademy).length) {
                        setExpandedAcademies(new Set());
                      } else {
                        setExpandedAcademies(new Set(Object.keys(groupedByAcademy)));
                      }
                    }}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    {expandedAcademies.size === Object.keys(groupedByAcademy).length 
                      ? "모두 접기" 
                      : "모두 펼치기"}
                  </button>
                )}
              </div>

              {/* 학원별 그룹 */}
              {Object.entries(groupedByAcademy).map(([academyName, academySchedules]) => {
                // 기존 일정과 중복되지 않는 항목만 필터링
                const selectableSchedules = academySchedules.filter(
                  (s) => !existingKeys.has(getScheduleKey(s))
                );
                
                if (selectableSchedules.length === 0) return null;
                
                const allSelected = selectableSchedules.every((s) =>
                  selectedSchedules.has(getScheduleKey(s))
                );

                const isExpanded = expandedAcademies.has(academyName);
                
                // 학원별 교과 목록 추출 (중복 제거)
                const subjects = Array.from(
                  new Set(academySchedules.map(s => s.subject).filter(Boolean))
                ) as string[];
                
                // 선택된 일정 개수
                const selectedCount = selectableSchedules.filter(s => 
                  selectedSchedules.has(getScheduleKey(s))
                ).length;

                // 학원별 일정을 요일별로 그룹화
                const schedulesByDay = academySchedules.reduce((acc, schedule) => {
                  const day = schedule.day_of_week;
                  if (!acc[day]) {
                    acc[day] = [];
                  }
                  acc[day].push(schedule);
                  return acc;
                }, {} as Record<number, AcademySchedule[]>);

                return (
                  <div key={academyName} className="rounded-lg border border-gray-200 bg-white">
                    {/* 학원 헤더 */}
                    <div className="flex w-full items-center justify-between gap-2 rounded-t-lg border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3">
                      {/* 클릭 가능한 영역 */}
                      <button
                        type="button"
                        onClick={() => toggleAcademy(academyName)}
                        className="flex flex-1 items-center gap-3 text-left hover:opacity-80 transition-opacity"
                      >
                        {/* 접힘/펼침 아이콘 */}
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        )}
                        
                        {/* 학원 정보 */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900">
                              {academyName}
                            </h3>
                            {subjects.length > 0 && (
                              <div className="flex gap-1">
                                {subjects.slice(0, 2).map((subject, idx) => (
                                  <span 
                                    key={idx}
                                    className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                                  >
                                    {subject}
                                  </span>
                                ))}
                                {subjects.length > 2 && (
                                  <span className="text-xs text-gray-500">
                                    +{subjects.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-600">
                            <span>총 {academySchedules.length}개 일정</span>
                            {selectedCount > 0 && (
                              <span className="font-medium text-blue-700">
                                ✓ {selectedCount}개 선택
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      
                      {/* 전체 선택/해제 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleSelectAcademy(academyName)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          allSelected
                            ? "bg-gray-900 text-white hover:bg-gray-800"
                            : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {allSelected ? "전체 해제" : "전체 선택"}
                      </button>
                    </div>
                    
                    {/* 요일별 일정 목록 - 접힘 상태에 따라 표시/숨김 */}
                    {isExpanded && (
                      <div className="p-4 space-y-3">
                        {Object.entries(schedulesByDay).map(([dayOfWeek, daySchedules]) => {
                      const day = Number(dayOfWeek);
                      return (
                        <div key={day} className="space-y-2">
                          <h4 className="text-xs font-medium text-gray-600">
                            {weekdayLabels[day]}요일
                          </h4>
                          <div className="space-y-2">
                            {daySchedules.map((schedule) => {
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
                                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
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
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      {schedule.subject && (
                                        <span>{schedule.subject}</span>
                                      )}
                                      {schedule.travel_time && (
                                        <span className="text-gray-500">
                                          이동시간: {schedule.travel_time}분
                                        </span>
                                      )}
                                    </div>
                                    {hasConflict && (
                                      <div className="flex flex-col gap-1 rounded border border-red-200 bg-white p-2 text-xs text-red-700">
                                        <p className="font-semibold">겹치는 일정:</p>
                                        {conflicts.map((conflictSchedule, idx) => (
                                          <p key={idx}>
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
                );
              })}
              </div>
            )}
          </div>
      </DialogContent>
      <DialogFooter>
        <div className="flex w-full items-center justify-between">
          <p className="text-sm text-gray-600">
            선택된 항목: <span className="font-semibold">{selectedSchedules.size}개</span>
            {conflictInfo.size > 0 && (
              <span className="text-red-600">
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
      </DialogFooter>
    </Dialog>
  );
}

