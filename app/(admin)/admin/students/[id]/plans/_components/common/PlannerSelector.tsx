"use client";

/**
 * PlannerSelector 공통 컴포넌트
 *
 * 플래너 선택 드롭다운 UI (모든 플랜 생성 모달에서 재사용)
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/common/PlannerSelector
 */

import { useQuery } from "@tanstack/react-query";
import { getStudentPlannersAction } from "@/lib/domains/admin-plan/actions/planners";
import type { Planner } from "@/lib/domains/admin-plan/actions/planners";
import { cn } from "@/lib/cn";

// ============================================
// 타입 정의
// ============================================

export interface PlannerSelectorProps {
  studentId: string;
  tenantId: string;
  selectedPlannerId: string | null;
  onSelect: (planner: Planner | null) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  helperText?: string;
  error?: string;
  className?: string;
}

// ============================================
// 컴포넌트
// ============================================

export function PlannerSelector({
  studentId,
  selectedPlannerId,
  onSelect,
  disabled = false,
  required = true,
  label = "플래너 선택",
  helperText,
  error,
  className,
}: PlannerSelectorProps) {
  // 플래너 목록 조회
  const { data: plannersResult, isLoading } = useQuery({
    queryKey: ["planners", studentId],
    queryFn: () =>
      getStudentPlannersAction(studentId, {
        status: ["draft", "active", "paused"],
        includeArchived: false,
      }),
    enabled: !!studentId,
    staleTime: 30_000, // 30초 캐시
  });

  const planners = plannersResult?.data || [];
  const selectedPlanner = planners.find((p) => p.id === selectedPlannerId);

  // 플래너 변경 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const plannerId = e.target.value;
    if (!plannerId) {
      onSelect(null);
      return;
    }
    const planner = planners.find((p) => p.id === plannerId);
    onSelect(planner || null);
  };

  // 상태 배지 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700";
      case "draft":
        return "bg-gray-100 text-gray-600";
      case "paused":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  // 상태 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "활성";
      case "draft":
        return "초안";
      case "paused":
        return "일시중지";
      case "archived":
        return "보관";
      case "completed":
        return "완료";
      default:
        return status;
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      {/* 라벨 */}
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {/* 선택 드롭다운 */}
      <select
        value={selectedPlannerId || ""}
        onChange={handleChange}
        disabled={disabled || isLoading}
        required={required}
        className={cn(
          "w-full px-3 py-2 text-sm border rounded-lg",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          "disabled:bg-gray-100 disabled:cursor-not-allowed",
          error ? "border-red-500" : "border-gray-300"
        )}
      >
        <option value="">
          {isLoading
            ? "로딩 중..."
            : planners.length === 0
              ? "플래너가 없습니다"
              : "플래너를 선택하세요"}
        </option>
        {planners.map((planner) => (
          <option key={planner.id} value={planner.id}>
            {planner.name} ({planner.periodStart} ~ {planner.periodEnd})
          </option>
        ))}
      </select>

      {/* 선택된 플래너 정보 */}
      {selectedPlanner && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedPlanner.name}
            </span>
            <span
              className={cn(
                "px-2 py-0.5 text-xs rounded",
                getStatusColor(selectedPlanner.status)
              )}
            >
              {getStatusText(selectedPlanner.status)}
            </span>
          </div>
          <div className="mt-1 text-xs text-blue-700">
            기간: {selectedPlanner.periodStart} ~ {selectedPlanner.periodEnd}
          </div>
          {selectedPlanner.studyHours && (
            <div className="mt-1 text-xs text-blue-600">
              학습시간: {selectedPlanner.studyHours.start} ~{" "}
              {selectedPlanner.studyHours.end}
            </div>
          )}
        </div>
      )}

      {/* 플래너 없음 경고 */}
      {!isLoading && planners.length === 0 && (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-amber-800">
                플래너가 없습니다
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                플랜을 추가하려면 먼저 플래너를 생성해주세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 도움말 텍스트 */}
      {helperText && !error && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}

      {/* 에러 메시지 */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default PlannerSelector;
