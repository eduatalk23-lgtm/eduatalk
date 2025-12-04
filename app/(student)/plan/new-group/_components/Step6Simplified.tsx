"use client";

import React from "react";
import { WizardData } from "./PlanGroupWizard";
import {
  CollapsibleSection,
  BasicInfoSummary,
  TimeSettingsSummary,
  ContentsSummary,
  LearningVolumeSummary,
  SubjectAllocationSummary,
} from "./_summary";

/**
 * Step6Simplified - 최종 확인 (간소화)
 *
 * Phase 4.4에서 구현
 *
 * 기존 Step6FinalReview (2,625 라인)를 간소화
 * - 접기/펼치기 UI
 * - 읽기 전용 중심
 * - 요약 정보만 표시
 * - 수정은 단계 이동
 */

export type Step6SimplifiedProps = {
  data: WizardData;
  onEditStep: (step: 1 | 2 | 4) => void;
  isCampMode?: boolean;
  isAdminContinueMode?: boolean;
};

export function Step6Simplified({
  data,
  onEditStep,
  isCampMode = false,
  isAdminContinueMode = false,
}: Step6SimplifiedProps) {
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">최종 확인</h2>
        <p className="mt-1 text-sm text-gray-600">
          플랜을 생성하기 전 마지막으로 확인해주세요. 수정이 필요하면 해당
          단계로 돌아갈 수 있습니다.
        </p>
      </div>

      {/* 섹션들 */}
      <div className="space-y-4">
        {/* 1. 기본 정보 */}
        <CollapsibleSection
          title="기본 정보"
          defaultOpen={false}
          onEdit={() => onEditStep(1)}
          editLabel="Step 1로 돌아가기"
        >
          <BasicInfoSummary data={data} />
        </CollapsibleSection>

        {/* 2. 시간 설정 */}
        <CollapsibleSection
          title="시간 설정"
          defaultOpen={false}
          onEdit={() => onEditStep(2)}
          editLabel="Step 2로 돌아가기"
        >
          <TimeSettingsSummary data={data} />
        </CollapsibleSection>

        {/* 3. 콘텐츠 선택 (기본 펼침) */}
        <CollapsibleSection
          title="콘텐츠 선택"
          defaultOpen={true}
          onEdit={() => onEditStep(4)}
          editLabel="Step 4로 돌아가기"
        >
          <ContentsSummary data={data} isCampMode={isCampMode} />
        </CollapsibleSection>

        {/* 4. 학습량 비교 */}
        <CollapsibleSection title="학습량 비교" defaultOpen={false}>
          <LearningVolumeSummary data={data} />
        </CollapsibleSection>

        {/* 5. 전략/취약 과목 */}
        {/* 관리자 모드에서는 항상 표시, 일반 모드에서는 캠프 모드이고 1730_timetable이고 subject_allocations가 있을 때만 표시 */}
        {(isAdminContinueMode ||
          (isCampMode &&
            data.scheduler_type === "1730_timetable" &&
            data.subject_allocations &&
            data.subject_allocations.length > 0)) && (
          <CollapsibleSection title="전략과목/취약과목" defaultOpen={false}>
            <SubjectAllocationSummary data={data} />
          </CollapsibleSection>
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-800"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-800">
              플랜 생성 전 확인사항
            </h4>
            <ul className="mt-2 space-y-1 text-sm text-blue-800">
              <li>• 모든 정보가 정확한지 확인해주세요</li>
              <li>
                • 수정이 필요하면 각 섹션의 &quot;돌아가기&quot; 버튼을
                클릭하세요
              </li>
              <li>• 플랜 생성 후에도 수정할 수 있습니다</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
