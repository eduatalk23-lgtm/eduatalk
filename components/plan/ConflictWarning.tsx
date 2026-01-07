"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { AlertTriangle, Clock, Calendar, ArrowRight } from "lucide-react";
import type { PlacementConflict } from "@/lib/domains/plan/services/AutoSlotPlacementService";

// ============================================
// 타입 정의
// ============================================

export interface ConflictWarningProps {
  /** 충돌 정보 목록 */
  conflicts: PlacementConflict[];
  /** 해결 옵션 선택 핸들러 */
  onResolve?: (
    conflict: PlacementConflict,
    resolution: "move" | "split" | "skip" | "alternative"
  ) => void;
  /** 대체 날짜 선택 핸들러 */
  onSelectAlternative?: (conflict: PlacementConflict, date: string) => void;
  /** 확장 모드 (세부 정보 표시) */
  expanded?: boolean;
  /** 클래스명 */
  className?: string;
}

interface SingleConflictProps {
  conflict: PlacementConflict;
  onResolve?: ConflictWarningProps["onResolve"];
  onSelectAlternative?: ConflictWarningProps["onSelectAlternative"];
  expanded?: boolean;
}

// ============================================
// 서브 컴포넌트
// ============================================

function SingleConflict({
  conflict,
  onResolve,
  onSelectAlternative,
  expanded,
}: SingleConflictProps) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      {/* 헤더 */}
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="font-medium text-sm text-amber-800">
            {conflict.contentTitle}
          </div>
          <div className="text-xs text-amber-700 mt-0.5">{conflict.reason}</div>
        </div>
      </div>

      {/* 겹치는 플랜 정보 */}
      {conflict.overlappingPlan && expanded && (
        <div className="ml-6 p-2 bg-white border border-amber-100 rounded text-xs">
          <div className="text-gray-600">겹치는 플랜:</div>
          <div className="mt-1 font-medium">
            {conflict.overlappingPlan.contentTitle || "플랜"}
          </div>
          <div className="text-gray-500">
            {conflict.overlappingPlan.date}{" "}
            {conflict.overlappingPlan.startTime} ~{" "}
            {conflict.overlappingPlan.endTime}
          </div>
        </div>
      )}

      {/* 대체 날짜 */}
      {conflict.suggestedDates && conflict.suggestedDates.length > 0 && (
        <div className="ml-6">
          <div className="text-xs text-amber-700 mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            대체 가능 날짜:
          </div>
          <div className="flex flex-wrap gap-1">
            {conflict.suggestedDates.map((date) => (
              <button
                key={date}
                onClick={() => onSelectAlternative?.(conflict, date)}
                className="px-2 py-0.5 text-xs bg-white border border-amber-300 rounded hover:bg-amber-100 transition-colors"
              >
                {date}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 해결 옵션 버튼 */}
      {onResolve && expanded && (
        <div className="ml-6 flex flex-wrap gap-2 mt-1">
          <button
            onClick={() => onResolve(conflict, "move")}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            <ArrowRight className="w-3 h-3" />
            다음 슬롯으로 이동
          </button>
          <button
            onClick={() => onResolve(conflict, "split")}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
          >
            <Clock className="w-3 h-3" />
            분할 배치
          </button>
          <button
            onClick={() => onResolve(conflict, "skip")}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            건너뛰기
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function ConflictWarning({
  conflicts,
  onResolve,
  onSelectAlternative,
  expanded = false,
  className,
}: ConflictWarningProps) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* 요약 헤더 */}
      <div className="flex items-center gap-2 p-2 bg-amber-100 border border-amber-300 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <span className="font-medium text-amber-800">
          {conflicts.length}개 콘텐츠 배치 실패
        </span>
        <span className="text-sm text-amber-700">
          - 가용시간이 부족하거나 충돌이 발생했습니다.
        </span>
      </div>

      {/* 개별 충돌 목록 */}
      <div className="flex flex-col gap-2">
        {conflicts.map((conflict, idx) => (
          <SingleConflict
            key={`${conflict.contentId}-${idx}`}
            conflict={conflict}
            onResolve={onResolve}
            onSelectAlternative={onSelectAlternative}
            expanded={expanded}
          />
        ))}
      </div>
    </div>
  );
}

export default ConflictWarning;
