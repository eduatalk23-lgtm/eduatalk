import { memo } from "react";
import type { Plan } from "./scheduleTypes";
import type { ContentData } from "../../../utils/scheduleTransform";
import { timeToMinutes } from "./scheduleUtils";
import { formatPlanTime, formatPlanLearningAmount } from "@/lib/utils/planFormatting";

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

    return (
      <table className="w-full text-xs border-collapse border border-blue-200">
        <thead className="bg-blue-100">
          <tr>
            <th className="px-3 py-2 text-center border border-blue-200 font-semibold text-blue-800">
              시간
            </th>
            <th className="px-3 py-2 text-center border border-blue-200 font-semibold text-blue-800">
              교과
            </th>
            <th className="px-3 py-2 text-center border border-blue-200 font-semibold text-blue-800">
              과목
            </th>
            <th className="px-3 py-2 text-center border border-blue-200 font-semibold text-blue-800">
              유형
            </th>
            <th className="px-3 py-2 text-center border border-blue-200 font-semibold text-blue-800">
              이름
            </th>
            <th className="px-3 py-2 text-center border border-blue-200 font-semibold text-blue-800">
              학습내역
            </th>
            <th className="px-3 py-2 text-center border border-blue-200 font-semibold text-blue-800">
              회차
            </th>
            <th className="px-3 py-2 text-center border border-blue-200 font-semibold text-blue-800">
              학습 분량
            </th>
            <th className="px-3 py-2 text-center border border-blue-200 font-semibold text-blue-800">
              소요시간
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.map((planTime, planIdx) => {
            const content = contents.get(planTime.plan.content_id);
            // 실제 배치된 시간 계산
            const actualDuration =
              timeToMinutes(planTime.end) - timeToMinutes(planTime.start);
            // originalEstimatedTime이 있으면 우선 사용 (DB 시간 또는 계산된 예상 시간)
            const displayDuration = planTime.originalEstimatedTime ?? actualDuration;
            const isReviewDay = dayType === "복습일";
            const showOriginalTime =
              isReviewDay &&
              planTime.originalEstimatedTime &&
              planTime.originalEstimatedTime > actualDuration;
            // plan_number 우선 사용, 없으면 sequence 사용, 둘 다 없으면 "-" 표시
              const planNumber = planTime.plan.plan_number ?? planTime.plan.sequence ?? null;

            return (
              <tr
                key={`${planTime.plan.id}-${planIdx}`}
                className={`hover:bg-blue-50 ${
                  planTime.isContinued ? "bg-blue-100" : ""
                }`}
              >
                <td className="px-3 py-2 border border-blue-200 text-blue-800 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {planTime.isContinued && (
                      <span className="text-blue-800 font-semibold text-[10px]">
                        [이어서]
                      </span>
                    )}
                    <span className="font-medium">
                      {planTime.start} ~ {planTime.end}
                    </span>
                    {planTime.isPartial && (
                      <span className="text-blue-800 text-[10px]">(일부)</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800 text-center">
                  {content?.subject_category || "-"}
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800 text-center">
                  {content?.subject || "-"}
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800 text-center">
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
                    title={planTime.plan.contentEpisode || planTime.plan.chapter || ""}
                  >
                    {planTime.plan.contentEpisode || planTime.plan.chapter || "-"}
                  </div>
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800 text-center">
                  {planNumber !== null ? planNumber : "-"}
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800 text-center">
                  {formatPlanLearningAmount(planTime.plan)}
                </td>
                <td className="px-3 py-2 border border-blue-200 text-blue-800 text-center">
                  <div className="flex flex-col gap-0.5 items-center">
                    <span>{formatPlanTime(displayDuration)}</span>
                    {showOriginalTime && (
                      <div className="text-orange-600 text-[10px]">
                        (예상: {formatPlanTime(planTime.originalEstimatedTime!)})
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
