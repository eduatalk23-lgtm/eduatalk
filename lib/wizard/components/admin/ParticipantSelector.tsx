"use client";

/**
 * ParticipantSelector - 참가자 선택 컴포넌트
 *
 * 배치 작업 대상 참가자를 선택하는 컴포넌트
 * 전체 선택, 필터링, 개별 선택 지원
 *
 * @module lib/wizard/components/admin/ParticipantSelector
 */

import { memo, useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { AdminParticipant } from "../../types";

// ============================================
// 타입 정의
// ============================================

export interface ParticipantSelectorProps {
  /** 전체 참가자 목록 */
  participants: AdminParticipant[];
  /** 선택된 참가자 ID 목록 */
  selectedIds: Set<string>;
  /** 선택 변경 핸들러 */
  onSelectionChange: (selectedIds: Set<string>) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 추가 클래스명 */
  className?: string;
}

// ============================================
// 메인 컴포넌트
// ============================================

/**
 * ParticipantSelector
 *
 * 배치 작업 대상 참가자를 선택하는 컴포넌트
 */
export const ParticipantSelector = memo(function ParticipantSelector({
  participants,
  selectedIds,
  onSelectionChange,
  disabled = false,
  className,
}: ParticipantSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "accepted" | "pending" | "declined">("all");

  // 필터링된 참가자 목록
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      // 검색 필터
      const matchesSearch =
        !searchQuery ||
        p.studentName.toLowerCase().includes(searchQuery.toLowerCase());

      // 상태 필터
      const matchesStatus =
        statusFilter === "all" || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [participants, searchQuery, statusFilter]);

  // 전체 선택 여부
  const isAllSelected = useMemo(() => {
    return (
      filteredParticipants.length > 0 &&
      filteredParticipants.every((p) => selectedIds.has(p.groupId))
    );
  }, [filteredParticipants, selectedIds]);

  // 일부 선택 여부
  const isPartialSelected = useMemo(() => {
    const selectedCount = filteredParticipants.filter((p) =>
      selectedIds.has(p.groupId)
    ).length;
    return selectedCount > 0 && selectedCount < filteredParticipants.length;
  }, [filteredParticipants, selectedIds]);

  // 전체 선택/해제
  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      // 필터된 항목 모두 해제
      const newSelection = new Set(selectedIds);
      filteredParticipants.forEach((p) => newSelection.delete(p.groupId));
      onSelectionChange(newSelection);
    } else {
      // 필터된 항목 모두 선택
      const newSelection = new Set(selectedIds);
      filteredParticipants.forEach((p) => newSelection.add(p.groupId));
      onSelectionChange(newSelection);
    }
  }, [filteredParticipants, selectedIds, isAllSelected, onSelectionChange]);

  // 개별 선택/해제
  const handleToggle = useCallback(
    (groupId: string) => {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(groupId)) {
        newSelection.delete(groupId);
      } else {
        newSelection.add(groupId);
      }
      onSelectionChange(newSelection);
    },
    [selectedIds, onSelectionChange]
  );

  // 상태별 배지 색상
  const getStatusBadge = (status?: AdminParticipant["status"]) => {
    switch (status) {
      case "accepted":
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            수락
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            대기
          </span>
        );
      case "declined":
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
            거절
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 필터 영역 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* 검색 */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름으로 검색..."
            disabled={disabled}
            className={cn(
              "w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:placeholder-gray-500",
              disabled && "cursor-not-allowed opacity-50"
            )}
          />
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* 상태 필터 */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          disabled={disabled}
          className={cn(
            "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <option value="all">전체 상태</option>
          <option value="accepted">수락</option>
          <option value="pending">대기</option>
          <option value="declined">거절</option>
        </select>
      </div>

      {/* 선택 정보 */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(el) => {
              if (el) el.indeterminate = isPartialSelected;
            }}
            onChange={handleSelectAll}
            disabled={disabled || filteredParticipants.length === 0}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span className="text-gray-600 dark:text-gray-400">
            전체 선택 ({selectedIds.size}/{participants.length})
          </span>
        </div>
        <span className="text-gray-500 dark:text-gray-500">
          {filteredParticipants.length}명 표시
        </span>
      </div>

      {/* 참가자 목록 */}
      <div className="max-h-64 divide-y divide-gray-200 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
        {filteredParticipants.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {searchQuery || statusFilter !== "all"
              ? "검색 결과가 없습니다"
              : "참가자가 없습니다"}
          </div>
        ) : (
          filteredParticipants.map((participant) => (
            <label
              key={participant.groupId}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-4 py-3 motion-safe:transition-colors hover:bg-gray-50 dark:hover:bg-gray-800",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(participant.groupId)}
                onChange={() => handleToggle(participant.groupId)}
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
              />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-gray-900 dark:text-white">
                  {participant.studentName}
                </p>
              </div>
              {getStatusBadge(participant.status)}
            </label>
          ))
        )}
      </div>
    </div>
  );
});
