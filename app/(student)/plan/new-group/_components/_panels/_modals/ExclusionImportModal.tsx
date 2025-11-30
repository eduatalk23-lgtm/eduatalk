"use client";

import React, { useState, useMemo } from "react";
import { X, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type Exclusion = {
  exclusion_date: string;
  exclusion_type: "휴가" | "개인사정" | "휴일지정" | "기타";
  reason?: string;
  source?: "template" | "student" | "time_management";
  is_locked?: boolean;
};

type ExclusionImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  availableExclusions: Exclusion[];
  existingExclusions: Exclusion[];
  onImport: (selectedExclusions: Exclusion[]) => void;
  periodStart: string;
  periodEnd: string;
};

const exclusionTypeColors = {
  휴가: "bg-blue-100 text-blue-800 border-blue-300",
  개인사정: "bg-purple-100 text-purple-800 border-purple-300",
  휴일지정: "bg-orange-100 text-orange-800 border-orange-300",
  기타: "bg-gray-100 text-gray-800 border-gray-300",
};

/**
 * 제외일 선택 불러오기 모달
 * - 플랜 기간 내 제외일 목록 표시
 * - 체크박스로 다중 선택
 * - 이미 등록된 제외일은 비활성화
 */
export function ExclusionImportModal({
  isOpen,
  onClose,
  availableExclusions,
  existingExclusions,
  onImport,
  periodStart,
  periodEnd,
}: ExclusionImportModalProps) {
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // 기존 제외일 날짜 Set
  const existingDatesSet = useMemo(() => {
    return new Set(existingExclusions.map((e) => e.exclusion_date));
  }, [existingExclusions]);

  // 플랜 기간 내 제외일 필터링 및 정렬
  const filteredExclusions = useMemo(() => {
    const startDate = new Date(periodStart);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(periodEnd);
    endDate.setHours(23, 59, 59, 999);

    return availableExclusions
      .filter((e) => {
        const exclusionDate = new Date(e.exclusion_date);
        exclusionDate.setHours(0, 0, 0, 0);
        return exclusionDate >= startDate && exclusionDate <= endDate;
      })
      .sort((a, b) => a.exclusion_date.localeCompare(b.exclusion_date));
  }, [availableExclusions, periodStart, periodEnd]);

  // 새로 추가 가능한 제외일
  const newExclusions = useMemo(() => {
    return filteredExclusions.filter(
      (e) => !existingDatesSet.has(e.exclusion_date)
    );
  }, [filteredExclusions, existingDatesSet]);

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedDates.size === newExclusions.length) {
      setSelectedDates(new Set());
    } else {
      setSelectedDates(new Set(newExclusions.map((e) => e.exclusion_date)));
    }
  };

  // 개별 선택/해제
  const handleToggle = (date: string) => {
    const newSet = new Set(selectedDates);
    if (newSet.has(date)) {
      newSet.delete(date);
    } else {
      newSet.add(date);
    }
    setSelectedDates(newSet);
  };

  // 등록 처리
  const handleImport = () => {
    const selectedExclusions = filteredExclusions.filter((e) =>
      selectedDates.has(e.exclusion_date)
    );
    onImport(selectedExclusions);
    setSelectedDates(new Set());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">
              제외일 불러오기
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
                <p className="font-semibold">
                  플랜 기간: {format(new Date(periodStart), "yyyy년 M월 d일", { locale: ko })} ~{" "}
                  {format(new Date(periodEnd), "yyyy년 M월 d일", { locale: ko })}
                </p>
                <p className="mt-1">
                  해당 기간 내 시간 관리에 등록된 제외일 목록입니다. 선택하여 등록하세요.
                </p>
              </div>
            </div>
          </div>

          {/* 제외일 목록 */}
          {filteredExclusions.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm font-medium text-gray-600">
                플랜 기간 내 등록된 제외일이 없습니다
              </p>
              <p className="mt-1 text-xs text-gray-500">
                시간 관리 메뉴에서 제외일을 먼저 등록해주세요.
              </p>
            </div>
          ) : newExclusions.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm font-medium text-gray-600">
                불러올 새로운 제외일이 없습니다
              </p>
              <p className="mt-1 text-xs text-gray-500">
                모든 제외일이 이미 등록되어 있습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 전체 선택 */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3">
                <input
                  type="checkbox"
                  checked={selectedDates.size === newExclusions.length}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm font-medium text-gray-900">
                  전체 선택 ({selectedDates.size} / {newExclusions.length})
                </span>
              </div>

              {/* 제외일 항목 */}
              {filteredExclusions.map((exclusion) => {
                const isExisting = existingDatesSet.has(exclusion.exclusion_date);
                const isSelected = selectedDates.has(exclusion.exclusion_date);

                return (
                  <div
                    key={exclusion.exclusion_date}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                      isExisting
                        ? "border-gray-200 bg-gray-50 opacity-60"
                        : isSelected
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(exclusion.exclusion_date)}
                      disabled={isExisting}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {format(new Date(exclusion.exclusion_date), "yyyy년 M월 d일 (E)", {
                            locale: ko,
                          })}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                            exclusionTypeColors[exclusion.exclusion_type]
                          }`}
                        >
                          {exclusion.exclusion_type}
                        </span>
                        {isExisting && (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                            등록됨
                          </span>
                        )}
                      </div>
                      {exclusion.reason && (
                        <p className="mt-1 text-xs text-gray-600">
                          사유: {exclusion.reason}
                        </p>
                      )}
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
            선택된 항목: <span className="font-semibold">{selectedDates.size}개</span>
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
              disabled={selectedDates.size === 0}
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

