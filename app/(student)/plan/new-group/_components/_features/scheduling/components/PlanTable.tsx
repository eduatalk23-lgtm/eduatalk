import { memo } from "react";
import type { Plan } from "./scheduleTypes";
import type { ContentData } from "../../utils/scheduleTransform";
import { timeToMinutes } from "./scheduleUtils";

// 플랜 표 컴포넌트
export const PlanTable = memo(
  function PlanTable({
    plans,
    contents,
    dayType,
    sequenceMap,
  }: {
    plans: Array<{
      plan: Plan;
      start: string;
      end: string;
      isPartial?: boolean;
      isContinued?: boolean;
      originalEstimatedTime?: number;
    }>;
    contents: Map<string, ContentData>;
    dayType: string;
    sequenceMap: Map<string, number>;
  }) {
    const formatTime = (minutes: number): string => {
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
    };

    const formatLearningAmount = (plan: Plan): string => {
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
    };

    return (
      <table className="w-full text-xs border-collapse border border-blue-200">
        <thead className="bg-blue-100">
          <tr>
            <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-800">
              시간
            </th>
            <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-800">
              교과
            </th>
            <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-800">
              과목
            </th>
            <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-800">
              유형
            </th>
            <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-800">
              이름
            </th>
            <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-800">
              학습내역
            </th>
            <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-800">
              회차
            </th>
            <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-800">
              학습 분량
            </th>
            <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-800">
              소요시간
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.map((planTime, planIdx) => {
            const content = contents.get(planTime.plan.content_id);
            const duration =
              timeToMinutes(planTime.end) - timeToMinutes(planTime.start);
            const isReviewDay = dayType === "복습일";
            const showOriginalTime =
              isReviewDay &&
              planTime.originalEstimatedTime &&
              planTime.originalEstimatedTime > duration;
            const sequence = planTime.plan.sequence || 1;

            return (
              <tr
                key={`${planTime.plan.id}-${planIdx}`}
                className={`hover:bg-blue-50 ${
                  planTime.isContinued ? "bg-blue-100" : ""
                }`}
              >
                <td className="px-3 py-2 border border-blue-200 text-blue-800">
                  <div className="flex items-center gap-1">
                    {planTime.isContinued && (
                      <span className="text-blue-800 font-semibold text-[10px]">
                        [이어서]
                      </span>
                    )}
                    <span className="font-medium">
                      {planTime.start} ~ {planTime.end}
                    </span>
                    <span className="text-blue-800">
                      ({formatTime(duration)})
                    </span>
                    {planTime.isPartial && (
                      <span className="text-blue-800 text-[10px]">(일부)</span>
                    )}
                    {showOriginalTime && (
                      <span className="text-orange-600 font-semibold text-[10px]">
                        [예상: {formatTime(planTime.originalEstimatedTime!)}]
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800">
                  {content?.subject_category || "-"}
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800">
                  {content?.subject || "-"}
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800">
                  {planTime.plan.content_type === "book" ? "교재" : "강의"}
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800">
                  <div
                    className="max-w-[200px] truncate"
                    title={content?.title || ""}
                  >
                    {content?.title || "-"}
                  </div>
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800">
                  <div
                    className="max-w-[200px] truncate"
                    title={planTime.plan.chapter || ""}
                  >
                    {planTime.plan.chapter || "-"}
                  </div>
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800 text-center">
                  {sequence}
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800">
                  {formatLearningAmount(planTime.plan)}
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800">
                  <div className="flex flex-col gap-0.5">
                    <span>{formatTime(duration)}</span>
                    {showOriginalTime && (
                      <div className="text-orange-600 text-[10px]">
                        (예상: {formatTime(planTime.originalEstimatedTime!)})
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  },
  (prevProps, nextProps) => {
    // plans 배열의 길이와 주요 속성만 비교
    return (
      prevProps.plans.length === nextProps.plans.length &&
      prevProps.dayType === nextProps.dayType &&
      prevProps.sequenceMap.size === nextProps.sequenceMap.size
    );
  }
);
