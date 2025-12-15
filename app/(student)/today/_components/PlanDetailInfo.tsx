"use client";

import { memo } from "react";
import { BookOpen, Repeat, Layers } from "lucide-react";
import { PlanGroup } from "../_utils/planGroupUtils";
import { getLearningRange } from "../_utils/planGroupUtils";

type PlanDetailInfoProps = {
  group: PlanGroup;
};

function PlanDetailInfoComponent({ group }: PlanDetailInfoProps) {
  const plan = group.plan;
  const learningRange = getLearningRange([plan]);
  const sequenceText = group.sequence
    ? `${group.sequence}회차`
    : `${plan.sequence || 1}회차`;

  return (
    <div className="flex items-center justify-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-gray-400" />
        <span className="text-gray-600">범위</span>
        <span className="font-semibold text-gray-900">{learningRange}</span>
      </div>
      <div className="h-4 w-px bg-gray-300"></div>
      <div className="flex items-center gap-2">
        <Repeat className="h-4 w-4 text-gray-400" />
        <span className="text-gray-600">회차</span>
        <span className="font-semibold text-gray-900">{sequenceText}</span>
      </div>
    </div>
  );
}

export const PlanDetailInfo = memo(PlanDetailInfoComponent, (prevProps, nextProps) => {
  // group의 주요 속성만 비교
  const prevPlan = prevProps.group.plan;
  const nextPlan = nextProps.group.plan;
  
  return (
    prevProps.group.planNumber === nextProps.group.planNumber &&
    prevPlan.id === nextPlan.id &&
    prevPlan.content_type === nextPlan.content_type &&
    prevPlan.content_id === nextPlan.content_id &&
    prevPlan.planned_start_page_or_time === nextPlan.planned_start_page_or_time &&
    prevPlan.planned_end_page_or_time === nextPlan.planned_end_page_or_time &&
    prevProps.group.sequence === nextProps.group.sequence
  );
});

