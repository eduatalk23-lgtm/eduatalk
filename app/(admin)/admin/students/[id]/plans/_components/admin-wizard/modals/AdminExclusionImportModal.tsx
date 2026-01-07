"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import type { ExclusionSchedule } from "../_context/types";

type AdminExclusionImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  availableExclusions: ExclusionSchedule[];
  existingExclusions: ExclusionSchedule[];
  onImport: (selectedExclusions: ExclusionSchedule[]) => void;
  periodStart: string;
  periodEnd: string;
};

const exclusionTypeColors: Record<ExclusionSchedule["exclusion_type"], string> = {
  holiday: "bg-orange-100 text-orange-800 border-orange-300",
  personal: "bg-purple-100 text-purple-800 border-purple-300",
  event: "bg-blue-100 text-blue-800 border-blue-300",
};

const exclusionTypeLabels: Record<ExclusionSchedule["exclusion_type"], string> = {
  holiday: "휴일",
  personal: "개인",
  event: "행사",
};

/**
 * 관리자용 제외일 불러오기 모달
 * - 학생의 시간 관리 데이터에서 제외일 선택
 * - 플랜 기간 내 제외일 목록 표시
 * - 체크박스로 다중 선택
 * - 이미 등록된 제외일은 비활성화
 */
export function AdminExclusionImportModal({
  isOpen,
  onClose,
  availableExclusions,
  existingExclusions,
  onImport,
  periodStart,
  periodEnd,
}: AdminExclusionImportModalProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // 모달 열릴 때 선택 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setSelectedKeys(new Set());
    }
  }, [isOpen]);

  // 제외일 고유 키 생성 함수 (날짜 + 유형)
  const getExclusionKey = (exclusion: ExclusionSchedule): string => {
    return `${exclusion.exclusion_date}-${exclusion.exclusion_type}`;
  };

  // 기존 제외일 키 Set (날짜+유형 조합)
  const existingKeys = useMemo(() => {
    return new Set(existingExclusions.map(getExclusionKey));
  }, [existingExclusions]);

  // 플랜 기간 내 제외일 필터링 및 정렬
  const filteredExclusions = useMemo(() => {
    if (!periodStart || !periodEnd) return [];

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

  // 새로 추가 가능한 제외일 (날짜+유형 조합으로 체크)
  const newExclusions = useMemo(() => {
    return filteredExclusions.filter(
      (e) => !existingKeys.has(getExclusionKey(e))
    );
  }, [filteredExclusions, existingKeys]);

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedKeys.size === newExclusions.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(newExclusions.map(getExclusionKey)));
    }
  };

  // 개별 선택/해제
  const handleToggle = (exclusion: ExclusionSchedule) => {
    const key = getExclusionKey(exclusion);
    const newSet = new Set(selectedKeys);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedKeys(newSet);
  };

  // 등록 처리
  const handleImport = () => {
    const selectedExclusions = filteredExclusions.filter((e) =>
      selectedKeys.has(getExclusionKey(e))
    );
    onImport(selectedExclusions);
    setSelectedKeys(new Set());
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
      title="제외일 불러오기"
      maxWidth="3xl"
    >
      <DialogContent className="max-h-[60vh] overflow-y-auto">
        <div className="flex flex-col gap-4">
          {/* 안내 메시지 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-blue-600" />
              <div className="flex flex-col gap-1 text-xs text-blue-800">
                {periodStart && periodEnd && (
                  <p className="font-semibold">
                    플랜 기간: {format(new Date(periodStart), "yyyy년 M월 d일", { locale: ko })} ~{" "}
                    {format(new Date(periodEnd), "yyyy년 M월 d일", { locale: ko })}
                  </p>
                )}
                <p>
                  해당 기간 내 학생의 시간 관리에 등록된 제외일 목록입니다. 선택하여 등록하세요.
                </p>
              </div>
            </div>
          </div>

          {/* 제외일 목록 */}
          {filteredExclusions.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8">
              <div className="flex flex-col items-center gap-2 text-center">
                <Calendar className="h-12 w-12 text-gray-400" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-gray-600">
                    플랜 기간 내 등록된 제외일이 없습니다
                  </p>
                  <p className="text-xs text-gray-500">
                    학생의 시간 관리 메뉴에서 제외일을 먼저 등록해주세요.
                  </p>
                </div>
              </div>
            </div>
          ) : newExclusions.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8">
              <div className="flex flex-col items-center gap-2 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-gray-600">
                    불러올 새로운 제외일이 없습니다
                  </p>
                  <p className="text-xs text-gray-500">
                    모든 제외일이 이미 등록되어 있습니다.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 전체 선택 */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3">
                <input
                  type="checkbox"
                  checked={selectedKeys.size === newExclusions.length && newExclusions.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm font-medium text-gray-900">
                  전체 선택 ({selectedKeys.size} / {newExclusions.length})
                </span>
              </div>

              {/* 제외일 항목 */}
              {filteredExclusions.map((exclusion) => {
                const exclusionKey = getExclusionKey(exclusion);
                const isExisting = existingKeys.has(exclusionKey);
                const isSelected = selectedKeys.has(exclusionKey);

                return (
                  <div
                    key={exclusionKey}
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
                      onChange={() => handleToggle(exclusion)}
                      disabled={isExisting}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="flex flex-col gap-1 flex-1">
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
                          {exclusionTypeLabels[exclusion.exclusion_type]}
                        </span>
                        {isExisting && (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                            등록됨
                          </span>
                        )}
                      </div>
                      {exclusion.reason && (
                        <p className="text-xs text-gray-600">
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
      </DialogContent>
      <DialogFooter>
        <div className="flex w-full items-center justify-between">
          <p className="text-sm text-gray-600">
            선택된 항목: <span className="font-semibold">{selectedKeys.size}개</span>
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
              disabled={selectedKeys.size === 0}
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
