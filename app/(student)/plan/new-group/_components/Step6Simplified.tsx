"use client";

import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
import { WizardData } from "./PlanGroupWizard";
import {
  CollapsibleSection,
  BasicInfoSummary,
  TimeSettingsSummary,
  ContentsSummary,
  LearningVolumeSummary,
  SubjectAllocationSummary,
} from "./_summary";
import { PlanWizardContext } from "./_context/PlanWizardContext";
import { StrategyWeaknessAllocationEditor } from "./_features/content-selection/Step6FinalReview/StrategyWeaknessAllocationEditor";
import { useContentInfos } from "./_features/content-selection/Step6FinalReview/hooks/useContentInfos";

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
  data?: WizardData; // Optional: usePlanWizard에서 가져올 수 있음
  onEditStep?: (step: 1 | 2 | 4) => void; // Optional: usePlanWizard에서 가져올 수 있음
  isCampMode?: boolean;
  isAdminContinueMode?: boolean;
  onUpdate?: (updates: Partial<WizardData>) => void;
  contents?: {
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null; master_lecture_id?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  studentId?: string;
  editable?: boolean;
  isTemplateMode?: boolean;
};

// SubjectAllocationEditor 컴포넌트 (관리자 모드용)
// StrategyWeaknessAllocationEditor를 사용하여 통합된 UI 제공
function SubjectAllocationEditor({
  data,
  onUpdate,
  contents,
  editable = true,
  studentId,
}: {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  contents: {
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null; master_lecture_id?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  editable?: boolean;
  studentId?: string;
}) {
  // useContentInfos 훅을 사용하여 contentInfos 생성 (subject_id 포함)
  const { contentInfos, loading } = useContentInfos({
    data,
    contents,
    isCampMode: false,
    studentId,
  });

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">콘텐츠 정보를 불러오는 중...</p>
      </div>
    );
  }

  // StrategyWeaknessAllocationEditor 사용
  return (
    <StrategyWeaknessAllocationEditor
      data={data}
      onUpdate={onUpdate}
      contentInfos={contentInfos}
      editable={editable}
    />
  );
}

export function Step6Simplified({
  data: dataProp,
  onEditStep: onEditStepProp,
  isCampMode = false,
  isAdminContinueMode = false,
  onUpdate: onUpdateProp,
  contents,
  studentId,
  editable = true,
  isTemplateMode = false,
}: Step6SimplifiedProps) {
  // usePlanWizard 훅 사용 (Context에서 데이터 가져오기) - optional
  // Context가 없으면 props만 사용
  const context = useContext(PlanWizardContext);
  const contextData = context?.state?.wizardData;
  const contextUpdateData = context?.updateData;
  const setStep = context?.setStep;
  
  // Props가 있으면 우선 사용, 없으면 Context에서 가져오기
  const data = dataProp ?? contextData;
  const onUpdate = onUpdateProp ?? contextUpdateData ?? (() => {}); // fallback to no-op
  const onEditStep = onEditStepProp ?? (setStep ? (step: 1 | 2 | 4) => setStep(step as any) : undefined);

  // data가 없으면 에러 메시지 표시
  if (!data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-800">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-gray-900">최종 확인</h2>
        <p className="text-sm text-gray-600">
          플랜을 생성하기 전 마지막으로 확인해주세요. 수정이 필요하면 해당
          단계로 돌아갈 수 있습니다.
        </p>
      </div>

      {/* 섹션들 */}
      <div className="flex flex-col gap-4">
        {/* 1. 기본 정보 */}
        <CollapsibleSection
          title="기본 정보"
          defaultOpen={false}
          onEdit={onEditStep ? () => onEditStep(1) : undefined}
          editLabel="Step 1로 돌아가기"
        >
          <BasicInfoSummary data={data} />
        </CollapsibleSection>

        {/* 2. 시간 설정 */}
        <CollapsibleSection
          title="시간 설정"
          defaultOpen={false}
          onEdit={onEditStep ? () => onEditStep(2) : undefined}
          editLabel="Step 2로 돌아가기"
        >
          <TimeSettingsSummary data={data} />
        </CollapsibleSection>

        {/* 3. 콘텐츠 선택 (기본 펼침) */}
        <CollapsibleSection
          title="콘텐츠 선택"
          defaultOpen={true}
          onEdit={onEditStep ? () => onEditStep(4) : undefined}
          editLabel="Step 4로 돌아가기"
        >
          <ContentsSummary data={data} isCampMode={isCampMode} />
        </CollapsibleSection>

        {/* 4. 학습량 비교 */}
        <CollapsibleSection title="학습량 비교" defaultOpen={false}>
          <LearningVolumeSummary data={data} />
        </CollapsibleSection>

        {/* 5. 전략/취약 과목 */}
        {/* 관리자 모드에서는 항상 표시, 일반 모드에서는 1730_timetable이고 subject_allocations가 있을 때 표시 */}
        {(isAdminContinueMode ||
          (data.scheduler_type === "1730_timetable" &&
            data.subject_allocations &&
            data.subject_allocations.length > 0)) && (
            <CollapsibleSection title="전략과목/취약과목" defaultOpen={false}>
            {isAdminContinueMode && typeof onUpdate === "function" && contents ? (
              <SubjectAllocationEditor
                data={data}
                onUpdate={onUpdate}
                contents={contents}
                editable={editable}
              />
            ) : (
              <SubjectAllocationSummary data={data} />
            )}
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
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-blue-800">
                플랜 생성 전 확인사항
              </h4>
              <ul className="flex flex-col gap-1 text-sm text-blue-800">
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
    </div>
  );
}
