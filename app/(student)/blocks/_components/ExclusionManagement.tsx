"use client";

import { useEffect, useState, useTransition } from "react";
import { supabase } from "@/lib/supabase/client";
import { addPlanExclusion, deletePlanExclusion } from "@/lib/domains/plan";
import type { PlanExclusion } from "@/lib/types/plan";
import { Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/molecules/EmptyState";
import { DateInput } from "@/app/(student)/plan/new-group/_components/common/DateInput";
import { generateDateRange, formatDateFromDate } from "@/lib/utils/date";
import { MultiSelectCalendar } from "./MultiSelectCalendar";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/Dialog";

type ExclusionManagementProps = {
  studentId: string;
  onAddRequest?: () => void;
  isAdding?: boolean;
};

type ExclusionInputType = "single" | "range" | "multiple";

const exclusionTypes = [
  { value: "휴가", label: "휴가" },
  { value: "개인사정", label: "개인사정" },
  { value: "휴일지정", label: "휴일지정" },
  { value: "기타", label: "기타" },
] as const;

export default function ExclusionManagement({
  studentId,
  onAddRequest,
  isAdding = false,
}: ExclusionManagementProps) {
  const [planExclusions, setPlanExclusions] = useState<PlanExclusion[]>([]);
  const [loading, setLoading] = useState(true);

  // 날짜 선택 타입
  const [exclusionInputType, setExclusionInputType] = useState<ExclusionInputType>("single");

  // 단일 날짜
  const [newExclusionDate, setNewExclusionDate] = useState("");

  // 범위 선택
  const [newExclusionStartDate, setNewExclusionStartDate] = useState("");
  const [newExclusionEndDate, setNewExclusionEndDate] = useState("");

  // 비연속 다중 선택
  const [newExclusionDates, setNewExclusionDates] = useState<string[]>([]);

  const [newExclusionType, setNewExclusionType] = useState<"휴가" | "개인사정" | "휴일지정" | "기타">("휴가");
  const [newExclusionReason, setNewExclusionReason] = useState("");
  const [isPending, startTransition] = useTransition();

  // Toast & Confirm Dialog
  const { showWarning, showError, showSuccess } = useToast();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [exclusionToDelete, setExclusionToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 학생별 전역 제외일 조회
      const { data: exclusions, error } = await supabase
        .from("plan_exclusions")
        .select("id,tenant_id,student_id,exclusion_date,exclusion_type,reason,created_at")
        .eq("student_id", studentId)
        .order("exclusion_date", { ascending: true });

      if (error) {
        console.error("[ExclusionManagement] 제외일 조회 실패", error);
        setPlanExclusions([]);
      } else {
        setPlanExclusions((exclusions as PlanExclusion[]) ?? []);
      }
    } catch (error: unknown) {
      console.error("학습 제외 일정 로드 실패:", error);
      
      // 네트워크 에러 구분
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error && typeof error === "object" && "code" in error ? error.code : undefined;
      const isNetworkError = 
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("network") ||
        errorCode === "ECONNABORTED" ||
        errorCode === "ETIMEDOUT";
      
      if (isNetworkError) {
        console.warn("네트워크 에러 발생 - 일부 데이터가 로드되지 않았을 수 있습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 비연속 다중 선택 토글
  const toggleExclusionDate = (date: string) => {
    setNewExclusionDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  // 현재 선택된 날짜 목록 가져오기 (비연속 다중 선택용)
  const getAvailableDates = (): string[] => {
    // 최근 1년 전부터 1년 후까지의 날짜 범위 제공
    const dates: string[] = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setFullYear(today.getFullYear() - 1);
    const endDate = new Date(today);
    endDate.setFullYear(today.getFullYear() + 1);
    
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(formatDateFromDate(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-gray-500 dark:text-gray-400">로딩 중...</p>
      </div>
    );
  }

  const handleAddExclusion = async () => {
    let datesToAdd: string[] = [];

    // 날짜 선택 타입에 따라 처리
    if (exclusionInputType === "single") {
      if (!newExclusionDate) {
        showWarning("날짜를 입력해주세요.");
        return;
      }
      datesToAdd = [newExclusionDate];
    } else if (exclusionInputType === "range") {
      if (!newExclusionStartDate || !newExclusionEndDate) {
        showWarning("시작일과 종료일을 선택해주세요.");
        return;
      }
      if (new Date(newExclusionStartDate) > new Date(newExclusionEndDate)) {
        showWarning("시작일은 종료일보다 앞서야 합니다.");
        return;
      }
      datesToAdd = generateDateRange(newExclusionStartDate, newExclusionEndDate);
    } else if (exclusionInputType === "multiple") {
      if (newExclusionDates.length === 0) {
        showWarning("날짜를 최소 1개 이상 선택해주세요.");
        return;
      }
      datesToAdd = [...newExclusionDates];
    }

    // 중복 체크
    const existingDates = new Set(planExclusions.map((e) => e.exclusion_date));
    const duplicates = datesToAdd.filter((date) => existingDates.has(date));

    if (duplicates.length > 0) {
      showWarning(`이미 등록된 제외일이 있습니다: ${duplicates.join(", ")}`);
      return;
    }

    startTransition(async () => {
      try {
        // 여러 날짜를 순차적으로 추가
        for (const date of datesToAdd) {
          const formData = new FormData();
          formData.append("exclusion_date", date);
          formData.append("exclusion_type", newExclusionType);
          if (newExclusionReason.trim()) {
            formData.append("reason", newExclusionReason.trim());
          }

          await addPlanExclusion(formData);
        }

        // 폼 초기화
        setNewExclusionDate("");
        setNewExclusionStartDate("");
        setNewExclusionEndDate("");
        setNewExclusionDates([]);
        setNewExclusionReason("");
        onAddRequest?.(); // 상위 컴포넌트에 상태 토글 요청

        showSuccess(`${datesToAdd.length}개의 제외일이 추가되었습니다.`);

        // 데이터 다시 로드
        await loadData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "제외일 추가에 실패했습니다.";
        showError(errorMessage);
      }
    });
  };

  const handleDeleteClick = (exclusionId: string) => {
    setExclusionToDelete(exclusionId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!exclusionToDelete) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("exclusion_id", exclusionToDelete);

        await deletePlanExclusion(formData);

        showSuccess("제외일이 삭제되었습니다.");

        // 데이터 다시 로드
        await loadData();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "제외일 삭제에 실패했습니다.";
        showError(errorMessage);
      } finally {
        setDeleteConfirmOpen(false);
        setExclusionToDelete(null);
      }
    });
  };

  // 유형별로 그룹화
  const exclusionsByType = planExclusions.reduce((acc, exclusion) => {
    const type = exclusion.exclusion_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(exclusion);
    return acc;
  }, {} as Record<string, PlanExclusion[]>);

  // 유형별로 정렬된 키 배열 (exclusionTypes 순서대로)
  const typeKeys = exclusionTypes
    .map((type) => type.value)
    .filter((type) => exclusionsByType[type] && exclusionsByType[type].length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 p-4 text-sm text-blue-800 dark:text-blue-300">
        <p className="font-medium">📌 학습 제외 일정은 학생별 전역으로 관리됩니다.</p>
        <p className="text-xs text-blue-700 dark:text-blue-400">
          등록한 제외일은 모든 플랜 그룹에서 공통으로 적용됩니다.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">학습 제외 일정</h3>
        </div>

        {/* 제외일 추가 폼 */}
        {isAdding && (
          <div className="flex flex-col gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-4">
            {/* 입력 유형 선택 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExclusionInputType("single")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  exclusionInputType === "single"
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                    : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                단일 날짜
              </button>
              <button
                type="button"
                onClick={() => setExclusionInputType("range")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  exclusionInputType === "range"
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                    : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                시작일 ~ 종료일
              </button>
              <button
                type="button"
                onClick={() => setExclusionInputType("multiple")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  exclusionInputType === "multiple"
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                    : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                비연속 다중 선택
              </button>
            </div>

            {/* 날짜 입력 */}
            {exclusionInputType === "single" && (
              <DateInput
                id="exclusion-single-date-input"
                label="날짜"
                labelClassName="text-xs"
                value={newExclusionDate}
                onChange={setNewExclusionDate}
              />
            )}

            {exclusionInputType === "range" && (
              <div className="grid grid-cols-2 gap-3">
                <DateInput
                  id="exclusion-range-start-date-input"
                  label="시작일"
                  labelClassName="text-xs"
                  value={newExclusionStartDate}
                  onChange={setNewExclusionStartDate}
                />
                <DateInput
                  id="exclusion-range-end-date-input"
                  label="종료일"
                  labelClassName="text-xs"
                  value={newExclusionEndDate}
                  onChange={setNewExclusionEndDate}
                />
              </div>
            )}

            {exclusionInputType === "multiple" && (
              <div className="flex flex-col gap-4">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  날짜 선택 (다중 선택 가능)
                </label>

                {/* 달력 컴포넌트 */}
                <MultiSelectCalendar
                  selectedDates={newExclusionDates}
                  excludedDates={planExclusions.map((e) => e.exclusion_date)}
                  onDateToggle={toggleExclusionDate}
                />

                {/* 선택된 날짜 목록 */}
                {newExclusionDates.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        선택된 날짜 ({newExclusionDates.length}개)
                      </p>
                      <button
                        type="button"
                        onClick={() => setNewExclusionDates([])}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        전체 삭제
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {newExclusionDates
                        .sort()
                        .map((date) => (
                          <div
                            key={date}
                            className="flex items-center gap-1 rounded-lg bg-gray-900 dark:bg-gray-100 px-2 py-1 text-xs text-white dark:text-gray-900"
                          >
                            <span>{date}</span>
                            <button
                              type="button"
                              onClick={() => toggleExclusionDate(date)}
                              className="hover:opacity-70"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 유형 및 사유 */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  유형 <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none"
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
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  사유 (선택사항)
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-400 focus:outline-none"
                  placeholder="예: 가족 여행"
                  value={newExclusionReason}
                  onChange={(e) => setNewExclusionReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddExclusion}
                disabled={
                  isPending ||
                  (exclusionInputType === "single" && !newExclusionDate) ||
                  (exclusionInputType === "range" &&
                    (!newExclusionStartDate || !newExclusionEndDate)) ||
                  (exclusionInputType === "multiple" &&
                    newExclusionDates.length === 0)
                }
                className="rounded-lg bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-500"
              >
                {isPending ? "추가 중..." : "추가"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddRequest?.(); // 상위 컴포넌트에 상태 토글 요청
                  setNewExclusionDate("");
                  setNewExclusionStartDate("");
                  setNewExclusionEndDate("");
                  setNewExclusionDates([]);
                  setNewExclusionReason("");
                }}
                disabled={isPending}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {planExclusions.length === 0 && !isAdding && (
          <EmptyState
            title="등록된 학습 제외 일정이 없습니다"
            description="휴가나 개인 사정으로 학습하지 않는 날을 등록하세요."
            icon="🗓️"
          />
        )}

        {/* 제외일 목록 (유형별 그룹화) */}
        {planExclusions.length > 0 && (
          <div className="flex flex-col gap-4">
            {typeKeys.map((type) => {
              const typeLabel = exclusionTypes.find((t) => t.value === type)?.label || type;
              const exclusions = exclusionsByType[type].sort(
                (a, b) => a.exclusion_date.localeCompare(b.exclusion_date)
              );

              return (
                <div key={type} className="flex flex-col gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {typeLabel} ({exclusions.length}개)
                  </h4>
                  <div className="flex flex-col gap-2">
                    {exclusions.map((exclusion) => (
                      <div
                        key={exclusion.id}
                        className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3"
                      >
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {exclusion.exclusion_date}
                          </div>
                          {exclusion.reason && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {exclusion.reason}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(exclusion.id)}
                          disabled={isPending}
                          className="rounded p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="제외일 삭제"
        description="이 제외일을 삭제하시겠습니까?"
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
        isLoading={isPending}
      />
    </div>
  );
}

