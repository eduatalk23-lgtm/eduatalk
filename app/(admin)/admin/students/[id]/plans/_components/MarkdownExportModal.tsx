"use client";

/**
 * 마크다운 내보내기 모달
 *
 * 플랜을 마크다운 형식으로 내보내는 기능을 제공합니다.
 * - 내보내기 범위: 오늘, 이번 주차, 플랜 그룹, 플래너 전체
 * - 포함 정보: 학생 정보, 플래너 설정, 제외일, 학원 일정, 통계
 */

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/cn";
import { FileText, X, Copy, Check, Download, Loader2, ChevronDown } from "lucide-react";
import { useAdminPlan } from "./context/AdminPlanContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ExportRange = "today" | "week" | "planGroup" | "planner";

export interface ExportOptions {
  includeStudentInfo: boolean;
  includePlannerSettings: boolean;
  includeExclusions: boolean;
  includeAcademySchedules: boolean;
  includeStatistics: boolean;
}

interface MarkdownExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeStudentInfo: true,
  includePlannerSettings: true,
  includeExclusions: true,
  includeAcademySchedules: true,
  includeStatistics: true,
};

export function MarkdownExportModal({
  isOpen,
  onClose,
}: MarkdownExportModalProps) {
  const {
    studentId,
    studentName,
    selectedPlannerId,
    activePlanGroupId,
    allPlanGroups,
    selectedDate,
  } = useAdminPlan();

  const [exportRange, setExportRange] = useState<ExportRange>("week");
  const [exportFormat, setExportFormat] = useState<"table" | "timetable">("table");
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 주차 선택 관련 상태
  const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [isLoadingWeeks, setIsLoadingWeeks] = useState(false);

  // 플랜 그룹 선택 상태 (모달 내에서 변경 가능)
  const [selectedPlanGroupId, setSelectedPlanGroupId] = useState<string | null>(
    activePlanGroupId
  );

  // activePlanGroupId 변경 시 selectedPlanGroupId 동기화
  useEffect(() => {
    setSelectedPlanGroupId(activePlanGroupId);
  }, [activePlanGroupId]);

  // 선택된 플랜 그룹의 주차 목록 조회 (전체 선택 시 플래너 전체 조회)
  useEffect(() => {
    async function fetchAvailableWeeks() {
      // 플래너가 없으면 조회 불가
      if (!selectedPlannerId) {
        setAvailableWeeks([]);
        setSelectedWeek(null);
        return;
      }

      setIsLoadingWeeks(true);
      try {
        const supabase = createSupabaseBrowserClient();

        // 플랜 그룹이 선택된 경우 해당 그룹만, 아니면 플래너 전체에서 조회
        let query = supabase
          .from("student_plan")
          .select("week, plan_groups!inner(planner_id)")
          .eq("is_active", true)
          .eq("plan_groups.planner_id", selectedPlannerId)
          .not("week", "is", null);

        if (selectedPlanGroupId) {
          query = query.eq("plan_group_id", selectedPlanGroupId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // 중복 제거 및 정렬
        const weeks = [...new Set(data?.map((p) => p.week as number) || [])].sort(
          (a, b) => a - b
        );
        setAvailableWeeks(weeks);

        // 현재 선택된 날짜가 속한 주차 찾기 또는 첫 번째 주차 선택
        if (weeks.length > 0) {
          // 선택된 날짜의 플랜에서 주차 확인
          let currentPlanQuery = supabase
            .from("student_plan")
            .select("week, plan_groups!inner(planner_id)")
            .eq("plan_groups.planner_id", selectedPlannerId)
            .eq("plan_date", selectedDate)
            .eq("is_active", true)
            .limit(1);

          if (selectedPlanGroupId) {
            currentPlanQuery = currentPlanQuery.eq("plan_group_id", selectedPlanGroupId);
          }

          const { data: currentPlan } = await currentPlanQuery.maybeSingle();

          if (currentPlan?.week && weeks.includes(currentPlan.week)) {
            setSelectedWeek(currentPlan.week);
          } else {
            setSelectedWeek(weeks[0]);
          }
        } else {
          setSelectedWeek(null);
        }
      } catch (err) {
        console.error("주차 목록 조회 실패:", err);
        setAvailableWeeks([]);
      } finally {
        setIsLoadingWeeks(false);
      }
    }

    fetchAvailableWeeks();
  }, [selectedPlannerId, selectedPlanGroupId, selectedDate]);

  // 선택된 플랜 그룹 이름
  const selectedPlanGroupName = allPlanGroups?.find(
    (g) => g.id === selectedPlanGroupId
  )?.name;

  // 내보내기 범위 옵션
  const rangeOptions: { value: ExportRange; label: string; description: string; hasWeekSelector?: boolean; hasPlanGroupSelector?: boolean }[] = [
    {
      value: "today",
      label: `오늘 (${selectedDate})`,
      description: "선택된 날짜의 플랜만 내보내기",
    },
    {
      value: "week",
      label: "주차 선택",
      description: "선택한 주차의 모든 플랜 내보내기",
      hasWeekSelector: true,
      hasPlanGroupSelector: true,
    },
    {
      value: "planGroup",
      label: "플랜 그룹 전체",
      description: "선택한 플랜 그룹의 모든 플랜 내보내기",
      hasPlanGroupSelector: true,
    },
    {
      value: "planner",
      label: "플래너 전체",
      description: "플래너의 모든 플랜 그룹과 플랜 내보내기",
    },
  ];

  // 포함 정보 옵션
  const includeOptions: { key: keyof ExportOptions; label: string }[] = [
    { key: "includeStudentInfo", label: "학생 정보" },
    { key: "includePlannerSettings", label: "플래너 설정 (시간대, 스케줄러)" },
    { key: "includeExclusions", label: "제외일 목록" },
    { key: "includeAcademySchedules", label: "학원 일정" },
    { key: "includeStatistics", label: "통계 정보" },
  ];

  const handleOptionChange = useCallback(
    (key: keyof ExportOptions) => {
      setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    []
  );

  const handleExport = useCallback(async () => {
    if (!selectedPlannerId) {
      setError("플래너를 선택해주세요.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMarkdown(null);

    try {
      const response = await fetch("/api/admin/plan/export/markdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          plannerId: selectedPlannerId,
          planGroupId: selectedPlanGroupId,
          exportRange,
          selectedDate,
          selectedWeek: exportRange === "week" ? selectedWeek : undefined,
          options,
          exportFormat,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "마크다운 생성에 실패했습니다");
      }

      setMarkdown(data.data.markdown);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다"
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    studentId,
    selectedPlannerId,
    selectedPlanGroupId,
    exportRange,
    selectedDate,
    selectedWeek,
    options,
    exportFormat,
  ]);

  const handleCopy = useCallback(async () => {
    if (!markdown) return;

    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("클립보드 복사에 실패했습니다");
    }
  }, [markdown]);

  const handleDownload = useCallback(() => {
    if (!markdown) return;

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan-export-${selectedDate}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdown, selectedDate]);

  const handleClose = useCallback(() => {
    setMarkdown(null);
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              마크다운 내보내기
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6">
          {!markdown ? (
            <div className="space-y-6">
              {/* 내보내기 범위 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  내보내기 범위
                </h3>
                <div className="space-y-2">
                  {rangeOptions.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition",
                        exportRange === option.value
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="exportRange"
                        value={option.value}
                        checked={exportRange === option.value}
                        onChange={() => setExportRange(option.value)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">
                            {option.label}
                          </span>
                          {/* 플랜 그룹 선택 드롭다운 */}
                          {option.hasPlanGroupSelector && exportRange === option.value && allPlanGroups && allPlanGroups.length > 0 && (
                            <div className="relative">
                              <select
                                value={selectedPlanGroupId || ""}
                                onChange={(e) => setSelectedPlanGroupId(e.target.value || null)}
                                onClick={(e) => e.stopPropagation()}
                                className="appearance-none pl-3 pr-8 py-1 text-sm rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px] truncate"
                              >
                                <option value="">전체</option>
                                {allPlanGroups.map((group) => (
                                  <option key={group.id} value={group.id}>
                                    {group.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                          )}
                          {/* 주차 선택 드롭다운 */}
                          {option.hasWeekSelector && exportRange === "week" && (
                            <div className="relative">
                              <select
                                value={selectedWeek || ""}
                                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                                onClick={(e) => e.stopPropagation()}
                                disabled={isLoadingWeeks || availableWeeks.length === 0}
                                className={cn(
                                  "appearance-none pl-3 pr-8 py-1 text-sm rounded-md border",
                                  "bg-white focus:outline-none focus:ring-2 focus:ring-blue-500",
                                  isLoadingWeeks ? "opacity-50" : ""
                                )}
                              >
                                {isLoadingWeeks ? (
                                  <option>로딩중...</option>
                                ) : availableWeeks.length === 0 ? (
                                  <option>주차 없음</option>
                                ) : (
                                  availableWeeks.map((week) => (
                                    <option key={week} value={week}>
                                      {week}주차
                                    </option>
                                  ))
                                )}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {option.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 내보내기 형식 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  내보내기 형식
                </h3>
                <div className="flex gap-3">
                  <label
                    className={cn(
                      "flex items-center gap-2 flex-1 p-3 rounded-lg border cursor-pointer transition",
                      exportFormat === "table"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="exportFormat"
                      value="table"
                      checked={exportFormat === "table"}
                      onChange={() => setExportFormat("table")}
                    />
                    <div>
                      <span className="font-medium text-gray-900">표 형식</span>
                      <p className="text-xs text-gray-500">날짜별 목록 테이블</p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-2 flex-1 p-3 rounded-lg border cursor-pointer transition",
                      exportFormat === "timetable"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="exportFormat"
                      value="timetable"
                      checked={exportFormat === "timetable"}
                      onChange={() => setExportFormat("timetable")}
                    />
                    <div>
                      <span className="font-medium text-gray-900">시간표 형식</span>
                      <p className="text-xs text-gray-500">시간 x 요일 그리드</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* 포함 정보 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  포함 정보 (선택)
                </h3>
                <div className="space-y-2">
                  {includeOptions.map((option) => (
                    <label
                      key={option.key}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={options[option.key]}
                        onChange={() => handleOptionChange(option.key)}
                        className="rounded"
                      />
                      <span className="text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
          ) : (
            /* 마크다운 미리보기 */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">미리보기</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-green-600">복사됨</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>복사</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                  >
                    <Download className="h-4 w-4" />
                    <span>다운로드</span>
                  </button>
                </div>
              </div>
              <pre className="p-4 bg-gray-50 border rounded-lg text-sm overflow-x-auto whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
                {markdown}
              </pre>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t px-6 py-4 flex justify-end gap-3">
          {markdown ? (
            <button
              onClick={() => setMarkdown(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              다시 설정
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                취소
              </button>
              <button
                onClick={handleExport}
                disabled={isLoading || !selectedPlannerId}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition",
                  isLoading || !selectedPlannerId
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    내보내기
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
