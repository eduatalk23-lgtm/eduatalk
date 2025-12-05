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
// 교과별로 그룹화하되, 각 콘텐츠마다 개별적으로 전략/취약 설정 가능
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

  // 교과별로 콘텐츠 그룹화
  const contentsBySubject = useMemo(() => {
    const map = new Map<string, typeof contentInfos>();
    contentInfos.forEach((content) => {
      if (content.subject_category) {
        if (!map.has(content.subject_category)) {
          map.set(content.subject_category, []);
        }
        map.get(content.subject_category)!.push(content);
      }
    });
    return map;
  }, [contentInfos]);

  const subjects = Array.from(contentsBySubject.keys()).sort();

  if (subjects.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">콘텐츠의 과목 정보가 없습니다.</p>
      </div>
    );
  }

  // 콘텐츠별 설정 변경 핸들러
  const handleContentAllocationChange = (
    content: { content_type: string; content_id: string },
    allocation: {
      subject_type: "strategy" | "weakness";
      weekly_days?: number;
    }
  ) => {
    if (!editable) return;
    const currentAllocations = data.content_allocations || [];
    const updatedAllocations = currentAllocations.filter(
      (a) =>
        !(
          a.content_type === content.content_type &&
          a.content_id === content.content_id
        )
    );
    updatedAllocations.push({
      content_type: content.content_type as "book" | "lecture",
      content_id: content.content_id,
      subject_type: allocation.subject_type,
      weekly_days: allocation.weekly_days,
    });
    onUpdate({ content_allocations: updatedAllocations });
  };

  // 폴백 메커니즘: content_allocations → subject_allocations → default
  const getEffectiveAllocation = (content: (typeof contentInfos)[0]) => {
    // 1순위: 콘텐츠별 설정
    const contentAlloc = (data.content_allocations || []).find(
      (a) =>
        a.content_type === content.content_type &&
        a.content_id === content.content_id
    );
    if (contentAlloc) {
      return {
        subject_type: contentAlloc.subject_type,
        weekly_days: contentAlloc.weekly_days,
        source: "content" as const,
      };
    }

    // 2순위: 교과별 설정 (폴백)
    if (content.subject_category) {
      const subjectAlloc = (data.subject_allocations || []).find(
        (a) => a.subject_name === content.subject_category
      );
      if (subjectAlloc) {
        return {
          subject_type: subjectAlloc.subject_type,
          weekly_days: subjectAlloc.weekly_days,
          source: "subject" as const,
        };
      }
    }

    // 3순위: 기본값
    return {
      subject_type: "weakness" as const,
      weekly_days: undefined,
      source: "default" as const,
    };
  };

  return (
    <div className="space-y-6">
      {subjects.map((subject) => {
        const contents = contentsBySubject.get(subject) || [];

        return (
          <div
            key={subject}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{subject}</h3>
              <span className="text-xs text-gray-600">
                {contents.length}개 콘텐츠
              </span>
            </div>
            <div className="space-y-3">
              {contents.map((content) => {
                const effectiveAlloc = getEffectiveAllocation(content);
                const subjectType = effectiveAlloc.subject_type;
                const weeklyDays = effectiveAlloc.weekly_days || 3;
                const source = effectiveAlloc.source;

                return (
                  <div
                    key={`${content.content_type}-${content.content_id}`}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {content.content_type === "book" ? "📚" : "🎧"}{" "}
                          {content.title}
                        </div>
                        {source !== "content" && (
                          <div className="mt-1 text-xs text-gray-600">
                            {source === "subject" && "교과별 설정 적용 중"}
                            {source === "default" && "기본값 (취약과목)"}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors hover:bg-gray-100">
                          <input
                            type="radio"
                            name={`content_type_${content.content_type}_${content.content_id}`}
                            value="weakness"
                            checked={subjectType === "weakness"}
                            onChange={() => {
                              handleContentAllocationChange(content, {
                                subject_type: "weakness",
                              });
                            }}
                            disabled={!editable}
                            className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          <span className="text-gray-900">취약과목</span>
                        </label>
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors hover:bg-gray-100">
                          <input
                            type="radio"
                            name={`content_type_${content.content_type}_${content.content_id}`}
                            value="strategy"
                            checked={subjectType === "strategy"}
                            onChange={() => {
                              handleContentAllocationChange(content, {
                                subject_type: "strategy",
                                weekly_days: 3,
                              });
                            }}
                            disabled={!editable}
                            className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          <span className="text-gray-900">전략과목</span>
                        </label>
                      </div>

                      {subjectType === "strategy" && (
                        <div>
                          <select
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
                            value={weeklyDays}
                            onChange={(e) => {
                              handleContentAllocationChange(content, {
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
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 설정 요약 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <h4 className="mb-2 text-xs font-semibold text-blue-800">설정 요약</h4>
        <div className="space-y-1 text-xs text-blue-800">
          <p>• 콘텐츠별 설정: {(data.content_allocations || []).length}개</p>
          <p>
            • 교과별 설정 (폴백): {(data.subject_allocations || []).length}개
          </p>
          <p className="text-blue-800">
            콘텐츠별 설정이 우선 적용되며, 설정되지 않은 콘텐츠는 교과별 설정을
            따릅니다.
          </p>
        </div>
      </div>
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
