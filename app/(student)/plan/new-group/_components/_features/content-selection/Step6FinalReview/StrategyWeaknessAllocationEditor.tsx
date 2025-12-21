"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { WizardData } from "../../../PlanGroupWizard";
import { ContentInfo } from "./types";
import { getEffectiveAllocation } from "@/lib/utils/subjectAllocation";
import { AllocationControls } from "./components/AllocationControls";
import { AllocationSourceBadge } from "./components/AllocationSourceBadge";
import { AllocationSummary } from "./components/AllocationSummary";

/**
 * StrategyWeaknessAllocationEditor - 전략과목/취약과목 설정 통합 에디터
 * 
 * 교과별/콘텐츠별 설정을 하나의 컴포넌트로 통합
 * 교재/강의 콘텐츠 선택 UI와 일관된 패턴 적용
 */
type StrategyWeaknessAllocationEditorProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  contentInfos: ContentInfo[];
  editable?: boolean;
};

export function StrategyWeaknessAllocationEditor({
  data,
  onUpdate,
  contentInfos,
  editable = true,
}: StrategyWeaknessAllocationEditorProps) {
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

  // 초기화 로직 제거: 사용자가 명시적으로 설정할 때만 데이터 생성
  // 폴백 메커니즘은 getEffectiveAllocation 함수에서 처리 (기본값: 취약과목)
  useEffect(() => {
    // 초기화 완료로 표시 (자동 데이터 생성 없음)
    if (!hasInitialized.current) {
      hasInitialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentInfos]);

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

  // 교과별 설정 모드 판단
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
      subject_id?: string;
      subject_name: string;
      subject_type: "strategy" | "weakness";
      weekly_days?: number;
    }
  ) => {
    if (!editable) return;

    // 해당 교과의 콘텐츠에서 실제 subject_id 추출
    const subjectContents = contentsBySubject.get(subject) || [];
    const actualSubjectId = subjectContents
      .map((c) => c.subject_id)
      .find((id) => id != null) || undefined;

    const currentAllocations = data.subject_allocations || [];
    const updatedAllocations = currentAllocations.filter(
      (a) => a.subject_name !== subject
    );
    updatedAllocations.push({
      ...allocation,
      subject_id: actualSubjectId || allocation.subject_id,
    });

    // 해당 교과의 content_allocations에서 제거
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
      const currentAllocations = data.subject_allocations || [];
      const updatedAllocations = currentAllocations.filter(
        (a) => a.subject_name !== subject
      );

      // 해당 교과의 콘텐츠에서 실제 subject_id 추출
      const subjectContents = contentsBySubject.get(subject) || [];
      const actualSubjectId = subjectContents
        .map((c) => c.subject_id)
        .find((id) => id != null) || undefined;

      updatedAllocations.push({
        subject_id: actualSubjectId,
        subject_name: subject,
        subject_type: "weakness",
      });

      // 해당 교과의 content_allocations에서 제거
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
  const getEffectiveAllocationForContent = (content: ContentInfo) => {
    return getEffectiveAllocation(
      {
        content_type: content.content_type,
        content_id: content.content_id,
        subject_category: content.subject_category || undefined,
        subject: null,
        subject_id: content.subject_id || undefined,
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
                  <h3 className="text-sm font-semibold text-gray-900">
                    {subject}
                  </h3>
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
                      <AllocationControls
                        subjectType={subjectType}
                        weeklyDays={subjectWeeklyDays}
                        onChange={(allocation) => {
                          handleSubjectAllocationChange(subject, {
                            subject_name: subject,
                            subject_type: allocation.subject_type,
                            weekly_days: allocation.weekly_days,
                          });
                        }}
                        disabled={!editable}
                        size="md"
                      />
                    </div>
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
                              {!isSubjectMode && (
                                <AllocationSourceBadge
                                  source={source}
                                  isSubjectMode={false}
                                />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 콘텐츠별 설정 UI (교과 단위 모드일 때는 비활성화) */}
                        {!isSubjectMode && (
                          <AllocationControls
                            subjectType={contentSubjectType}
                            weeklyDays={contentWeeklyDays}
                            onChange={(allocation) => {
                              handleContentAllocationChange(content, allocation);
                            }}
                            disabled={!editable || isContentDisabled}
                            size="sm"
                          />
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
      <AllocationSummary
        contentAllocationsCount={(data.content_allocations || []).length}
        subjectAllocationsCount={(data.subject_allocations || []).length}
      />
    </div>
  );
}

