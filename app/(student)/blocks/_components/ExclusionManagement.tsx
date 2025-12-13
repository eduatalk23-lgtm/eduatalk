"use client";

import { useEffect, useState, useTransition } from "react";
import { supabase } from "@/lib/supabase/client";
import { addPlanExclusion, deletePlanExclusion } from "@/app/(student)/actions/planGroupActions";
import type { PlanExclusion } from "@/lib/types/plan";
import { Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

type ExclusionManagementProps = {
  studentId: string;
  onAddRequest?: () => void;
  isAdding?: boolean;
};

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
  const [newExclusionDate, setNewExclusionDate] = useState("");
  const [newExclusionType, setNewExclusionType] = useState<"휴가" | "개인사정" | "휴일지정" | "기타">("휴가");
  const [newExclusionReason, setNewExclusionReason] = useState("");
  const [isPending, startTransition] = useTransition();

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
    } catch (error: any) {
      console.error("학습 제외 일정 로드 실패:", error);
      
      // 네트워크 에러 구분
      const isNetworkError = 
        error?.message?.includes("Failed to fetch") ||
        error?.message?.includes("NetworkError") ||
        error?.message?.includes("network") ||
        error?.code === "ECONNABORTED" ||
        error?.code === "ETIMEDOUT";
      
      if (isNetworkError) {
        console.warn("네트워크 에러 발생 - 일부 데이터가 로드되지 않았을 수 있습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    );
  }

  const handleAddExclusion = async () => {
    if (!newExclusionDate) {
      alert("날짜를 입력해주세요.");
      return;
    }

    // 클라이언트 측 중복 체크
    const existingDate = planExclusions.find(
      (e) => e.exclusion_date === newExclusionDate
    );
    if (existingDate) {
      alert(`이미 등록된 제외일입니다: ${newExclusionDate}`);
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("exclusion_date", newExclusionDate);
        formData.append("exclusion_type", newExclusionType);
        if (newExclusionReason.trim()) {
          formData.append("reason", newExclusionReason.trim());
        }

        await addPlanExclusion(formData);

        // 폼 초기화
        setNewExclusionDate("");
        setNewExclusionReason("");
        onAddRequest?.(); // 상위 컴포넌트에 상태 토글 요청

        // 데이터 다시 로드
        await loadData();
      } catch (error: any) {
        alert(error.message || "제외일 추가에 실패했습니다.");
      }
    });
  };

  const handleDeleteExclusion = async (exclusionId: string) => {
    if (!confirm("이 제외일을 삭제하시겠습니까?")) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("exclusion_id", exclusionId);

        await deletePlanExclusion(formData);

        // 데이터 다시 로드
        await loadData();
      } catch (error: any) {
        alert(error.message || "제외일 삭제에 실패했습니다.");
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
      <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">📌 학습 제외 일정은 학생별 전역으로 관리됩니다.</p>
        <p className="text-xs text-blue-700">
          등록한 제외일은 모든 플랜 그룹에서 공통으로 적용됩니다.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">학습 제외 일정</h3>
        </div>

        {/* 제외일 추가 폼 */}
        {isAdding && (
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium text-gray-700">
                  날짜 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  value={newExclusionDate}
                  onChange={(e) => setNewExclusionDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="block text-xs font-medium text-gray-700">
                  유형 <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
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
                <label className="block text-xs font-medium text-gray-700">
                  사유 (선택사항)
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
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
                disabled={isPending || !newExclusionDate}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isPending ? "추가 중..." : "추가"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddRequest?.(); // 상위 컴포넌트에 상태 토글 요청
                  setNewExclusionDate("");
                  setNewExclusionReason("");
                }}
                disabled={isPending}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                <div key={type} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {typeLabel} ({exclusions.length}개)
                  </h4>
                  <div className="flex flex-col gap-2">
                    {exclusions.map((exclusion) => (
                      <div
                        key={exclusion.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {exclusion.exclusion_date}
                          </div>
                          {exclusion.reason && (
                            <div className="mt-1 text-xs text-gray-500">
                              {exclusion.reason}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExclusion(exclusion.id)}
                          disabled={isPending}
                          className="ml-4 rounded p-1 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  );
}

