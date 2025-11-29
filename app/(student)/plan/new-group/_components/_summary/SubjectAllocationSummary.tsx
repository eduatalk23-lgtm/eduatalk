"use client";

import React, { useMemo } from "react";
import { Star, AlertTriangle } from "lucide-react";
import { WizardData } from "../PlanGroupWizard";
import { SectionSummary } from "./SectionSummary";

/**
 * SubjectAllocationSummary - 전략/취약 과목 요약
 * 
 * Phase 4.3에서 구현
 * 캠프 모드에서 전략과목/취약과목 정보를 표시
 */

export type SubjectAllocationSummaryProps = {
  data: WizardData;
};

export const SubjectAllocationSummary = React.memo(
  function SubjectAllocationSummary({ data }: SubjectAllocationSummaryProps) {
    // subject_allocations 파싱
    const allocations = useMemo(() => {
      if (!data.subject_allocations) return [];

      return data.subject_allocations.map((alloc) => ({
        subject: alloc.subject,
        type: alloc.allocation_type,
        days: alloc.weekly_allocation_days || 0,
      }));
    }, [data.subject_allocations]);

    // 전략과목과 취약과목 분리
    const strategicSubjects = useMemo(() => {
      return allocations.filter((a) => a.type === "전략과목");
    }, [allocations]);

    const weakSubjects = useMemo(() => {
      return allocations.filter((a) => a.type === "취약과목");
    }, [allocations]);

    // 빈 상태
    if (allocations.length === 0) {
      return (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-600">
            전략과목/취약과목이 설정되지 않았습니다
          </p>
          <p className="mt-1 text-xs text-gray-500">
            모든 과목이 동일하게 배정됩니다
          </p>
        </div>
      );
    }

    const items = [];

    // 전략과목
    if (strategicSubjects.length > 0) {
      items.push({
        label: "전략과목",
        value: `${strategicSubjects.length}개`,
        icon: <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />,
        highlight: true,
      });

      strategicSubjects.forEach((subject) => {
        items.push({
          label: `  • ${subject.subject}`,
          value: `주 ${subject.days}일`,
        });
      });
    }

    // 취약과목
    if (weakSubjects.length > 0) {
      items.push({
        label: "취약과목",
        value: `${weakSubjects.length}개`,
        icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
        highlight: true,
      });

      weakSubjects.forEach((subject) => {
        items.push({
          label: `  • ${subject.subject}`,
          value: "집중 학습",
        });
      });
    }

    return (
      <div className="space-y-4">
        {/* 요약 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              <div>
                <div className="text-sm font-medium text-yellow-900">
                  전략과목
                </div>
                <div className="text-xl font-bold text-yellow-900">
                  {strategicSubjects.length}개
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-sm font-medium text-orange-900">
                  취약과목
                </div>
                <div className="text-xl font-bold text-orange-900">
                  {weakSubjects.length}개
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 상세 */}
        <SectionSummary items={items} variant="compact" />

        {/* 설명 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-800">
            <strong>전략과목</strong>: 주당 배정 일수만큼 우선 배정됩니다
            <br />
            <strong>취약과목</strong>: 가능한 많은 시간을 배정합니다
          </p>
        </div>
      </div>
    );
  }
);

