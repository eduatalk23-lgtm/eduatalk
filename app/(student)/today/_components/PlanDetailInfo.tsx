"use client";

import { BookOpen, Repeat, Layers } from "lucide-react";
import { PlanGroup } from "../_utils/planGroupUtils";
import { getLearningRange } from "../_utils/planGroupUtils";

type PlanDetailInfoProps = {
  group: PlanGroup;
};

export function PlanDetailInfo({ group }: PlanDetailInfoProps) {
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

