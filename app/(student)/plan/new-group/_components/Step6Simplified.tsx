"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { WizardData } from "./PlanGroupWizard";
import {
  CollapsibleSection,
  BasicInfoSummary,
  TimeSettingsSummary,
  ContentsSummary,
  LearningVolumeSummary,
  SubjectAllocationSummary,
} from "./_summary";
import { getEffectiveAllocation } from "@/lib/utils/subjectAllocation";
import { usePlanWizard } from "./PlanWizardContext";

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

  // 초기화 여부 추적을 위한 ref
  const hasInitialized = useRef(false);

  // 초기 로드 시 기본값 자동 저장
  useEffect(() => {
    // 이미 초기화되었거나 콘텐츠가 없으면 스킵
    if (hasInitialized.current || contentInfos.length === 0) {
      return;
    }

    // 초기화 조건 확인: content_allocations와 subject_allocations가 모두 비어있는 경우
    const hasContentAllocations = (data.content_allocations || []).length > 0;
    const hasSubjectAllocations = (data.subject_allocations || []).length > 0;
    
    if (!hasContentAllocations && !hasSubjectAllocations) {
      // 모든 콘텐츠에 대해 기본값(취약과목)을 content_allocations에 자동으로 추가
      const defaultContentAllocations = contentInfos.map((content) => ({
        content_type: content.content_type as "book" | "lecture",
        content_id: content.content_id,
        subject_type: "weakness" as const,
        weekly_days: undefined,
      }));
      
      onUpdate({ content_allocations: defaultContentAllocations });
      hasInitialized.current = true;
    } else {
      // 이미 데이터가 있으면 초기화 완료로 표시
      hasInitialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentInfos, data.content_allocations, data.subject_allocations]);

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

  // 교과별 설정 모드 판단: subject_allocations에 있으면 교과 단위, content_allocations에 해당 교과 콘텐츠가 있으면 콘텐츠별, 둘 다 없으면 기본값 교과 단위
  const getSubjectAllocationMode = (subject: string): "subject" | "content" => {
    // subject_allocations에 해당 교과가 있으면 교과 단위 설정 모드
    const hasSubjectAllocation = (data.subject_allocations || []).some(
      (a) => a.subject_name === subject
    );
    if (hasSubjectAllocation) {
      return "subject";
    }

    // content_allocations에 해당 교과의 콘텐츠가 있으면 콘텐츠별 설정 모드
    const subjectContents = contentsBySubject.get(subject) || [];
    const hasContentAllocation = subjectContents.some((content) =>
      (data.content_allocations || []).some(
        (a) =>
          a.content_type === content.content_type &&
          a.content_id === content.content_id
      )
    );
    if (hasContentAllocation) {
      return "content";
    }

    // 둘 다 없으면 기본값: 교과 단위 설정 모드
    return "subject";
  };

  // 교과 단위 설정 변경 핸들러
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
    
    // 해당 교과의 content_allocations에서 제거
    const subjectContents = contentsBySubject.get(subject) || [];
    const updatedContentAllocations = (data.content_allocations || []).filter(
      (a) =>
        !subjectContents.some(
          (c) =>
            c.content_type === a.content_type && c.content_id === a.content_id
        )
    );

    onUpdate({
      subject_allocations: updatedAllocations,
      content_allocations: updatedContentAllocations,
    });
  };

  // 설정 모드 전환 핸들러
  const handleModeChange = (subject: string, mode: "subject" | "content") => {
    if (!editable) return;
    
    if (mode === "subject") {
      // 교과 단위 설정 모드로 전환
      // 기본값으로 취약과목 설정
      const currentAllocations = data.subject_allocations || [];
      const updatedAllocations = currentAllocations.filter(
        (a) => a.subject_name !== subject
      );
      updatedAllocations.push({
        subject_id: subject.toLowerCase().replace(/\s+/g, "_"),
        subject_name: subject,
        subject_type: "weakness",
      });

      // 해당 교과의 content_allocations에서 제거
      const subjectContents = contentsBySubject.get(subject) || [];
      const updatedContentAllocations = (data.content_allocations || []).filter(
        (a) =>
          !subjectContents.some(
            (c) =>
              c.content_type === a.content_type &&
              c.content_id === a.content_id
          )
      );

      onUpdate({
        subject_allocations: updatedAllocations,
        content_allocations: updatedContentAllocations,
      });
    } else {
      // 콘텐츠별 설정 모드로 전환
      // subject_allocations에서 해당 교과 제거
      const updatedAllocations = (data.subject_allocations || []).filter(
        (a) => a.subject_name !== subject
      );
      
      // 기존 교과 단위 설정 값 가져오기
      const existingSubjectAllocation = (data.subject_allocations || []).find(
        (a) => a.subject_name === subject
      );
      
      // 해당 교과의 콘텐츠 목록 가져오기
      const subjectContents = contentsBySubject.get(subject) || [];
      
      // 기존 content_allocations 가져오기
      const currentContentAllocations = data.content_allocations || [];
      
      // 해당 교과의 기존 content_allocations 제거 (중복 방지)
      const filteredContentAllocations = currentContentAllocations.filter(
        (a) =>
          !subjectContents.some(
            (c) =>
              c.content_type === a.content_type &&
              c.content_id === a.content_id
          )
      );
      
      // 기존 교과 단위 설정 값이 있으면 각 콘텐츠에 복사
      // 없으면 기본값(취약과목)으로 각 콘텐츠에 설정
      const allocationToApply = existingSubjectAllocation || {
        subject_type: "weakness" as const,
        weekly_days: undefined,
      };
      
      subjectContents.forEach((content) => {
        // 이미 content_allocations에 있는지 확인
        const existingContentAlloc = currentContentAllocations.find(
          (a) =>
            a.content_type === content.content_type &&
            a.content_id === content.content_id
        );
        
        // 없으면 기존 교과 단위 설정 값(또는 기본값)으로 추가
        if (!existingContentAlloc) {
          filteredContentAllocations.push({
            content_type: content.content_type as "book" | "lecture",
            content_id: content.content_id,
            subject_type: allocationToApply.subject_type,
            weekly_days: allocationToApply.weekly_days,
          });
        }
      });
      
      onUpdate({
        subject_allocations: updatedAllocations,
        content_allocations: filteredContentAllocations,
      });
    }
  };

  // 폴백 메커니즘: 공통 유틸리티 함수 사용
  const getEffectiveAllocationForContent = (content: (typeof contentInfos)[0]) => {
    return getEffectiveAllocation(
      {
        content_type: content.content_type,
        content_id: content.content_id,
        subject_category: content.subject_category || undefined,
        subject: null,
        subject_id: undefined,
      },
      data.content_allocations?.map((a) => ({
        content_type: a.content_type as "book" | "lecture" | "custom",
        content_id: a.content_id,
        subject_type: a.subject_type,
        weekly_days: a.weekly_days,
      })),
      data.subject_allocations?.map((a) => ({
        subject_id: a.subject_id,
        subject_name: a.subject_name,
        subject_type: a.subject_type,
        weekly_days: a.weekly_days,
      })),
      false // UI에서는 로깅 비활성화
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {subjects.map((subject) => {
        const contents = contentsBySubject.get(subject) || [];
        const allocationMode = getSubjectAllocationMode(subject);
        const isSubjectMode = allocationMode === "subject";
        
        // 교과 단위 설정 정보
        const subjectAllocation = (data.subject_allocations || []).find(
          (a) => a.subject_name === subject
        );
        const subjectType = subjectAllocation?.subject_type || "weakness";
        const subjectWeeklyDays = subjectAllocation?.weekly_days || 3;

        return (
          <div
            key={subject}
            className="rounded-xl border border-gray-200 bg-white p-6"
          >
            <div className="flex flex-col gap-4">
              {/* 교과 헤더 */}
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-900">{subject}</h3>
                <span className="text-xs text-gray-600">
                  {contents.length}개 콘텐츠
                </span>
              </div>
              
              {/* 설정 모드 토글 */}
              <div className="inline-flex rounded-lg border border-gray-300 p-1">
                <button
                  type="button"
                  onClick={() => handleModeChange(subject, "subject")}
                  disabled={!editable}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSubjectMode
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  교과 단위 설정
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange(subject, "content")}
                  disabled={!editable}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    !isSubjectMode
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  콘텐츠별 설정
                </button>
              </div>
            </div>

            {/* 교과 단위 설정 UI */}
            {isSubjectMode && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="block text-xs font-medium text-gray-600">
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
                  <div className="flex flex-col gap-2">
                    <label className="block text-xs font-medium text-gray-600">
                      주당 배정 일수
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
                      value={subjectWeeklyDays}
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
                    <p className="text-xs text-gray-600">
                      선택한 주당 일수에 따라 학습일에 균등하게 배정됩니다.
                    </p>
                  </div>
                )}
                </div>
              </div>
            )}

            {/* 콘텐츠 목록 */}
            <div className="flex flex-col gap-3">
              {contents.map((content) => {
                const effectiveAlloc = getEffectiveAllocationForContent(content);
                const contentSubjectType = effectiveAlloc.subject_type;
                const contentWeeklyDays = effectiveAlloc.weekly_days || 3;
                const source = effectiveAlloc.source;
                const isContentDisabled = isSubjectMode && !editable;

                return (
                  <div
                    key={`${content.content_type}-${content.content_id}`}
                    className={`rounded-lg border border-gray-200 p-3 ${
                      isSubjectMode ? "bg-gray-50 opacity-75" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-medium text-gray-900">
                              {content.content_type === "book" ? "📚" : "🎧"}{" "}
                              {content.title}
                            </div>
                            {isSubjectMode && (
                              <div className="text-xs text-gray-600">
                                교과 단위 설정 적용 중
                              </div>
                            )}
                            {!isSubjectMode && source !== "content" && (
                              <div className="text-xs text-gray-600">
                                {source === "subject" && "교과별 설정 적용 중"}
                                {source === "default" && "기본값 (취약과목)"}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 콘텐츠별 설정 UI (교과 단위 모드일 때는 비활성화) */}
                      {!isSubjectMode && (
                        <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors hover:bg-gray-100">
                            <input
                              type="radio"
                              name={`content_type_${content.content_type}_${content.content_id}`}
                              value="weakness"
                              checked={contentSubjectType === "weakness"}
                              onChange={() => {
                                handleContentAllocationChange(content, {
                                  subject_type: "weakness",
                                });
                              }}
                              disabled={!editable || isContentDisabled}
                              className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <span className="text-gray-900">취약과목</span>
                          </label>
                          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded border p-2 text-xs transition-colors hover:bg-gray-100">
                            <input
                              type="radio"
                              name={`content_type_${content.content_type}_${content.content_id}`}
                              value="strategy"
                              checked={contentSubjectType === "strategy"}
                              onChange={() => {
                                handleContentAllocationChange(content, {
                                  subject_type: "strategy",
                                  weekly_days: 3,
                                });
                              }}
                              disabled={!editable || isContentDisabled}
                              className="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <span className="text-gray-900">전략과목</span>
                          </label>
                        </div>

                        {contentSubjectType === "strategy" && (
                          <div>
                            <select
                              className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60"
                              value={contentWeeklyDays}
                              onChange={(e) => {
                                handleContentAllocationChange(content, {
                                  subject_type: "strategy",
                                  weekly_days: Number(e.target.value),
                                });
                              }}
                              disabled={!editable || isContentDisabled}
                            >
                              <option value="2">주 2일</option>
                              <option value="3">주 3일</option>
                              <option value="4">주 4일</option>
                            </select>
                          </div>
                        )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        );
      })}

      {/* 설정 요약 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-blue-800">설정 요약</h4>
          <div className="flex flex-col gap-1 text-xs text-blue-800">
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
    </div>
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
  // usePlanWizard 훅 사용 (Context에서 데이터 가져오기)
  const {
    state: { wizardData: contextData },
    updateData: contextUpdateData,
    setStep,
  } = usePlanWizard();
  
  // Props가 있으면 우선 사용, 없으면 Context에서 가져오기
  const data = dataProp ?? contextData;
  const onUpdate = onUpdateProp ?? contextUpdateData;
  const onEditStep = onEditStepProp ?? setStep;

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
        {/* 관리자 모드에서는 항상 표시, 일반 모드에서는 1730_timetable이고 subject_allocations가 있을 때 표시 */}
        {(isAdminContinueMode ||
          (data.scheduler_type === "1730_timetable" &&
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
