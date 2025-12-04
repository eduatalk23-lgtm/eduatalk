"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  onUpdate?: (updates: Partial<WizardData>) => void;
  contents?: {
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  studentId?: string;
  editable?: boolean;
  isTemplateMode?: boolean;
};

// SubjectAllocationEditor 컴포넌트 (관리자 모드용)
function SubjectAllocationEditor({
  data,
  onUpdate,
  contents,
  editable = true,
}: {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  contents: {
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
  };
  editable?: boolean;
}) {
  // contentInfos 생성 (data.student_contents와 data.recommended_contents에서)
  const contentInfos = useMemo(() => {
    const infos: Array<{
      content_type: "book" | "lecture";
      content_id: string;
      title: string;
      subject_category: string | null;
      isRecommended: boolean;
    }> = [];

    // 학생 콘텐츠
    data.student_contents.forEach((content) => {
      infos.push({
        content_type: content.content_type as "book" | "lecture",
        content_id: content.content_id,
        title: content.title || "알 수 없음",
        subject_category: content.subject_category || null,
        isRecommended: false,
      });
    });

    // 추천 콘텐츠
    data.recommended_contents.forEach((content) => {
      infos.push({
        content_type: content.content_type as "book" | "lecture",
        content_id: content.content_id,
        title: content.title || "알 수 없음",
        subject_category: content.subject_category || null,
        isRecommended: true,
      });
    });

    return infos;
  }, [data.student_contents, data.recommended_contents]);

  // 과목 추출
  const allSubjects = new Set<string>();
  contentInfos.forEach((content) => {
    if (content.subject_category) {
      allSubjects.add(content.subject_category);
    }
  });
  const subjects = Array.from(allSubjects).sort();

  if (subjects.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">콘텐츠의 과목 정보가 없습니다.</p>
      </div>
    );
  }

  const handleSubjectAllocationChange = (
    subject: string,
    allocation: {
      subject_id: string;
      subject_name: string;
      subject_type: "strategy" | "weakness";
      weekly_days?: number;
    }
  ) => {
    if (!editable) return;
    const currentAllocations = data.subject_allocations || [];
    const updatedAllocations = currentAllocations.filter(
      (a) => a.subject_name !== subject
    );
    updatedAllocations.push(allocation);
    onUpdate({ subject_allocations: updatedAllocations });
  };

  return (
    <div className="space-y-4">
      {subjects.map((subject) => {
        const existingAllocation = (data.subject_allocations || []).find(
          (a) => a.subject_name === subject
        );
        const subjectType = existingAllocation?.subject_type || "weakness";
        const weeklyDays = existingAllocation?.weekly_days || 3;

        const subjectContentCount = contentInfos.filter(
          (c) => c.subject_category === subject
        ).length;

        return (
          <div
            key={subject}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{subject}</h3>
              <span className="text-xs text-gray-600">
                {subjectContentCount}개 콘텐츠
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-600">
                  과목 유형
                </label>
                <div className="flex gap-3">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-gray-100">
                    <input
                      type="radio"
                      name={`subject_type_${subject}`}
                      value="weakness"
                      checked={subjectType === "weakness"}
                      onChange={() => {
                        handleSubjectAllocationChange(subject, {
                          subject_id: subject
                            .toLowerCase()
                            .replace(/\s+/g, "_"),
                          subject_name: subject,
                          subject_type: "weakness",
                        });
                      }}
                      disabled={!editable}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        취약과목
                      </div>
                      <div className="text-xs text-gray-600">
                        전체 학습일에 플랜 배정
                      </div>
                    </div>
                  </label>
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-gray-100">
                    <input
                      type="radio"
                      name={`subject_type_${subject}`}
                      value="strategy"
                      checked={subjectType === "strategy"}
                      onChange={() => {
                        handleSubjectAllocationChange(subject, {
                          subject_id: subject
                            .toLowerCase()
                            .replace(/\s+/g, "_"),
                          subject_name: subject,
                          subject_type: "strategy",
                          weekly_days: 3,
                        });
                      }}
                      disabled={!editable}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        전략과목
                      </div>
                      <div className="text-xs text-gray-600">
                        주당 배정 일수에 따라 배정
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {subjectType === "strategy" && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-600">
                    주당 배정 일수
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
                    value={weeklyDays}
                    onChange={(e) => {
                      handleSubjectAllocationChange(subject, {
                        subject_id: subject.toLowerCase().replace(/\s+/g, "_"),
                        subject_name: subject,
                        subject_type: "strategy",
                        weekly_days: Number(e.target.value),
                      });
                    }}
                    disabled={!editable}
                  >
                    <option value="2">주 2일</option>
                    <option value="3">주 3일</option>
                    <option value="4">주 4일</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-600">
                    선택한 주당 일수에 따라 학습일에 균등하게 배정됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Step6Simplified({
  data,
  onEditStep,
  isCampMode = false,
  isAdminContinueMode = false,
  onUpdate,
  contents,
  studentId,
  editable = true,
  isTemplateMode = false,
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
            {isAdminContinueMode && onUpdate && contents ? (
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
