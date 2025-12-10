"use client";

import { useState, useTransition, useMemo } from "react";
import { X } from "lucide-react";
import { previewPlansFromGroupAction, generatePlansFromGroupAction, checkPlansExistAction } from "@/app/(student)/actions/planGroupActions";

type PlanPreview = {
  plan_date: string;
  block_index: number;
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  content_title: string | null;
  content_subject: string | null;
  content_subject_category: string | null;
  content_category: string | null;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  chapter: string | null;
  start_time: string | null;
  end_time: string | null;
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | null;
  week: number | null;
  day: number | null;
  is_partial: boolean;
  is_continued: boolean;
  plan_number: number | null;
};

type PlanPreviewDialogProps = {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlansGenerated?: () => void;
  isRegenerateMode?: boolean; // 이미 플랜이 생성되어 있는 경우 true
};

const contentTypeLabels: Record<string, string> = {
  book: "교재",
  lecture: "강의",
  custom: "커스텀",
};

// 시간 문자열을 분으로 변환
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// 분을 시간 문자열로 변환
function formatTime(minutes: number): string {
  if (minutes === 0) return "0분";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}시간 ${mins}분`;
  } else if (hours > 0) {
    return `${hours}시간`;
  } else {
    return `${mins}분`;
  }
}

// 학습 분량 포맷팅
function formatLearningAmount(plan: PlanPreview): string {
  if (
    plan.planned_start_page_or_time === null ||
    plan.planned_end_page_or_time === null
  ) {
    return "-";
  }

  if (plan.content_type === "book") {
    return `${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}p`;
  } else if (plan.content_type === "lecture") {
    return `${plan.planned_start_page_or_time}강`;
  }

  return `${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`;
}

// 회차 계산 최적화: 모든 플랜의 회차를 한 번에 계산
// 같은 plan_number를 가진 플랜들은 같은 회차를 가짐
function calculateAllSequences(plans: PlanPreview[]): Map<string, number> {
  const sequenceMap = new Map<string, number>();
  
  // 1. content_id별로 그룹화
  const plansByContent = new Map<string, PlanPreview[]>();
  plans.forEach((plan) => {
    if (!plansByContent.has(plan.content_id)) {
      plansByContent.set(plan.content_id, []);
    }
    plansByContent.get(plan.content_id)!.push(plan);
  });
  
  // 2. 각 content_id별로 회차 계산
  plansByContent.forEach((contentPlans, contentId) => {
    // 날짜 순으로 정렬
    const sorted = [...contentPlans].sort((a, b) => {
      if (a.plan_date !== b.plan_date) {
        return a.plan_date.localeCompare(b.plan_date);
      }
      return (a.block_index || 0) - (b.block_index || 0);
    });
    
    // plan_number별 그룹화
    const planNumberGroups = new Map<number | null, PlanPreview[]>();
    sorted.forEach(plan => {
      const key = plan.plan_number;
      if (!planNumberGroups.has(key)) {
        planNumberGroups.set(key, []);
      }
      planNumberGroups.get(key)!.push(plan);
    });
    
    // 회차 계산 (plan_number 그룹 단위)
    let sequence = 1;
    planNumberGroups.forEach((group, planNumber) => {
      // 같은 plan_number를 가진 그룹의 모든 플랜에 같은 회차 할당
      group.forEach(plan => {
        const key = `${plan.plan_date}-${plan.block_index}-${plan.content_id}`;
        sequenceMap.set(key, sequence);
      });
      sequence++;
    });
  });
  
  return sequenceMap;
}

export function PlanPreviewDialog({
  groupId,
  open,
  onOpenChange,
  onPlansGenerated,
  isRegenerateMode = false,
}: PlanPreviewDialogProps) {
  const [plans, setPlans] = useState<PlanPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGenerating, startGenerateTransition] = useTransition();

  const handlePreview = async () => {
    setLoading(true);
    try {
      // 미리보기는 실제 플랜을 생성하지 않음 (데이터만 반환)
      const result = await previewPlansFromGroupAction(groupId);
      setPlans(result.plans);
      // 미리보기에서는 onPlansGenerated를 호출하지 않음 (실제 생성이 아니므로)
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "플랜 미리보기에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    const message = isRegenerateMode
      ? "플랜을 재생성하시겠습니까? 기존 플랜이 삭제되고 새로 생성됩니다."
      : "플랜을 생성하시겠습니까? 기존 플랜이 있다면 삭제되고 새로 생성됩니다.";
    
    if (!confirm(message)) {
      return;
    }

    startGenerateTransition(async () => {
      try {
        // 실제 플랜 생성
        const result = await generatePlansFromGroupAction(groupId);
        
        // 플랜이 실제로 생성되었는지 확인
        const checkResult = await checkPlansExistAction(groupId);
        if (!checkResult.hasPlans) {
          alert("플랜 생성에 실패했습니다. 플랜이 생성되지 않았습니다.");
          return;
        }
        
        alert(`${result.count}개의 플랜이 생성되었습니다.`);
        
        // 실제 플랜 생성이 완료된 경우에만 콜백 호출
        onPlansGenerated?.();
        onOpenChange(false);
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "플랜 생성에 실패했습니다."
        );
        // 에러 발생 시 콜백 호출하지 않음
      }
    });
  };

  // 날짜별로 그룹화 (useMemo로 최적화)
  const plansByDate = useMemo(() => {
    const map = new Map<string, PlanPreview[]>();
    plans.forEach((plan) => {
      if (!map.has(plan.plan_date)) {
        map.set(plan.plan_date, []);
      }
      map.get(plan.plan_date)!.push(plan);
    });
    return map;
  }, [plans]);

  // 날짜별로 정렬 (useMemo로 최적화)
  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => {
      if (a.plan_date !== b.plan_date) {
        return a.plan_date.localeCompare(b.plan_date);
      }
      // 같은 날짜면 시간 순으로 정렬
      if (a.start_time && b.start_time) {
        return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
      }
      return a.block_index - b.block_index;
    });
  }, [plans]);

  const sortedDates = useMemo(() => {
    return Array.from(plansByDate.keys()).sort();
  }, [plansByDate]);

  // 회차 계산 (useMemo로 최적화)
  const sequenceMap = useMemo(() => {
    return calculateAllSequences(sortedPlans);
  }, [sortedPlans]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">플랜 미리보기</h2>
            <p className="mt-1 text-sm text-gray-800">
              생성될 플랜 정보를 확인하세요. 총 {plans.length}개의 플랜이 생성됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex flex-col gap-4 p-6">
          {/* 미리보기 버튼 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handlePreview}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
            >
              {loading ? "로딩 중..." : "미리보기"}
            </button>
            {plans.length > 0 && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
              >
                {isGenerating ? "생성 중..." : isRegenerateMode ? "재생성하기" : "플랜 생성하기"}
              </button>
            )}
          </div>

          {/* 플랜 테이블 */}
          {plans.length > 0 && (
            <div className="overflow-auto max-h-[60vh] rounded-lg border border-blue-200">
              <table className="w-full text-xs border-collapse border border-blue-200">
                <thead className="sticky top-0 bg-blue-100">
                  <tr>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      플랜번호
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      주차
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      일차
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      날짜
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      날짜 유형
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      상태뱃지
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      시작시간
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      종료시간
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      교과
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      과목
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      유형
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      이름
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      학습내역
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      회차
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      학습 분량
                    </th>
                    <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
                      소요시간
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlans.map((plan, index) => {
                    const duration = plan.start_time && plan.end_time
                      ? timeToMinutes(plan.end_time) - timeToMinutes(plan.start_time)
                      : 0;
                    const sequenceKey = `${plan.plan_date}-${plan.block_index}-${plan.content_id}`;
                    const sequence = sequenceMap.get(sequenceKey) || 1;
                    const dateObj = new Date(plan.plan_date);
                    const formattedDate = dateObj.toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      weekday: "short",
                    });

                    return (
                      <tr
                        key={`${plan.plan_date}-${plan.block_index}-${index}`}
                        className={`hover:bg-blue-50 ${
                          plan.is_continued ? "bg-blue-100" : ""
                        }`}
                      >
                        <td className="px-3 py-2 border border-blue-200 text-blue-700 text-center">
                          {plan.plan_number !== null ? plan.plan_number : "-"}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700 text-center">
                          {plan.week !== null ? `${plan.week}주차` : "-"}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700 text-center">
                          {plan.day !== null ? `${plan.day}일차` : "-"}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          {formattedDate}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          {plan.day_type || "-"}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          <div className="flex items-center gap-1">
                            {plan.is_continued && (
                              <span className="text-blue-600 font-semibold text-[10px]">[이어서]</span>
                            )}
                            {plan.is_partial && (
                              <span className="text-blue-600 text-[10px]">(일부)</span>
                            )}
                            {!plan.is_continued && !plan.is_partial && (
                              <span className="text-gray-700">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          {plan.start_time || "-"}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          {plan.end_time || "-"}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          {plan.content_subject_category || "-"}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          {plan.content_subject || "-"}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          {contentTypeLabels[plan.content_type] || plan.content_type}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          <div className="max-w-[200px] truncate" title={plan.content_title || ""}>
                            {plan.content_title || "-"}
                          </div>
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          <div className="max-w-[200px] truncate" title={plan.chapter || ""}>
                            {plan.chapter || "-"}
                          </div>
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700 text-center">
                          {sequence}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          {formatLearningAmount(plan)}
                        </td>
                        <td className="px-3 py-2 border border-blue-200 text-blue-700">
                          {duration > 0 ? formatTime(duration) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {plans.length === 0 && !loading && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
              <p className="text-sm text-gray-800">
                "플랜 미리보기" 버튼을 클릭하여 생성될 플랜을 확인하세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

