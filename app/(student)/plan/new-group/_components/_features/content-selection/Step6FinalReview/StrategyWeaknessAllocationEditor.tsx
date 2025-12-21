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
  // 교과별로 콘텐츠 그룹화 (subject_group_name 기준)
  const contentsBySubjectGroup = useMemo(() => {
    const map = new Map<string, typeof contentInfos>();
    contentInfos.forEach((content) => {
      // 교과명이 있으면 교과명으로, 없으면 과목명으로 그룹화 (하위 호환성)
      const groupKey = content.subject_group_name || content.subject_category || "기타";
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey)!.push(content);
    });
    return map;
  }, [contentInfos]);

  const subjectGroups = Array.from(contentsBySubjectGroup.keys()).sort();

  // 교과별 일괄 설정 상태 관리
  const [batchSettingSubjectGroup, setBatchSettingSubjectGroup] = React.useState<string | null>(null);

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

  if (subjectGroups.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">콘텐츠의 교과 정보가 없습니다.</p>
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

  // 교과별 일괄 설정 핸들러
  const handleSubjectGroupBatchAllocation = (
    subjectGroup: string,
    allocation: {
      subject_type: "strategy" | "weakness";
      weekly_days?: number;
    }
  ) => {
    if (!editable) return;

    const subjectGroupContents = contentsBySubjectGroup.get(subjectGroup) || [];
    if (subjectGroupContents.length === 0) return;

    // 해당 교과의 콘텐츠에서 실제 subject_id 추출
    const actualSubjectId = subjectGroupContents
      .map((c) => c.subject_id)
      .find((id) => id != null) || undefined;

    // 교과 단위 설정 저장 (subject_allocations)
    const currentSubjectAllocations = data.subject_allocations || [];
    const updatedSubjectAllocations = currentSubjectAllocations.filter(
      (a) => a.subject_name !== subjectGroup
    );
    updatedSubjectAllocations.push({
      subject_id: actualSubjectId,
      subject_name: subjectGroup,
      subject_type: allocation.subject_type,
      weekly_days: allocation.weekly_days,
    });

    // 해당 교과의 모든 콘텐츠에 동일한 설정 적용 (content_allocations)
    const currentContentAllocations = data.content_allocations || [];
    
    // 기존 content_allocations에서 해당 교과의 콘텐츠 제거
    const filteredContentAllocations = currentContentAllocations.filter(
      (a) =>
        !subjectGroupContents.some(
          (c) =>
            c.content_type === a.content_type && c.content_id === a.content_id
        )
    );

    // 모든 콘텐츠에 동일한 설정 추가
    subjectGroupContents.forEach((content) => {
      filteredContentAllocations.push({
        content_type: content.content_type as "book" | "lecture",
        content_id: content.content_id,
        subject_type: allocation.subject_type,
        weekly_days: allocation.weekly_days,
      });
    });

    onUpdate({
      subject_allocations: updatedSubjectAllocations,
      content_allocations: filteredContentAllocations,
    });

    // 일괄 설정 UI 닫기
    setBatchSettingSubjectGroup(null);
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
      {subjectGroups.map((subjectGroup) => {
        const contents = contentsBySubjectGroup.get(subjectGroup) || [];
        
        // 교과 단위 설정 정보 (참고용)
        const subjectGroupAllocation = (data.subject_allocations || []).find(
          (a) => a.subject_name === subjectGroup
        );

        return (
          <div
            key={subjectGroup}
            className="rounded-xl border border-gray-200 bg-white p-6"
          >
            <div className="flex flex-col gap-4">
              {/* 교과 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {subjectGroup}
                  </h3>
                  <span className="text-xs text-gray-600">
                    {contents.length}개 콘텐츠
                  </span>
                </div>
                
                {/* 교과별 일괄 설정 버튼 (콘텐츠 2개 이상일 때만 표시) */}
                {contents.length >= 2 && editable && (
                  <button
                    type="button"
                    onClick={() => {
                      setBatchSettingSubjectGroup(
                        batchSettingSubjectGroup === subjectGroup ? null : subjectGroup
                      );
                    }}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {batchSettingSubjectGroup === subjectGroup
                      ? "일괄 설정 취소"
                      : "교과별 일괄 설정"}
                  </button>
                )}
              </div>

              {/* 교과별 일괄 설정 UI */}
              {batchSettingSubjectGroup === subjectGroup && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-900">
                        {subjectGroup} 전체 일괄 설정
                      </span>
                      <span className="text-xs text-blue-700">
                        ({contents.length}개 콘텐츠에 동일하게 적용됩니다)
                      </span>
                    </div>
                    <AllocationControls
                      subjectType={subjectGroupAllocation?.subject_type || "weakness"}
                      weeklyDays={subjectGroupAllocation?.weekly_days || 3}
                      onChange={(allocation) => {
                        handleSubjectGroupBatchAllocation(subjectGroup, allocation);
                      }}
                      disabled={!editable}
                      size="md"
                    />
                  </div>
                </div>
              )}

              {/* 콘텐츠 목록 - 각 콘텐츠에서 취약/전략 선택 */}
              <div className="flex flex-col gap-3">
                {contents.map((content) => {
                  const effectiveAlloc = getEffectiveAllocationForContent(content);
                  const contentSubjectType = effectiveAlloc.subject_type;
                  const contentWeeklyDays = effectiveAlloc.weekly_days || 3;
                  const source = effectiveAlloc.source;

                  return (
                    <div
                      key={`${content.content_type}-${content.content_id}`}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                    >
                      <div className="flex flex-col gap-3">
                        {/* 콘텐츠 정보 */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-medium text-gray-900">
                                {content.content_type === "book" ? "📚" : "🎧"}{" "}
                                {content.title}
                              </div>
                              {content.subject && (
                                <div className="text-xs text-gray-600">
                                  {content.subject}
                                </div>
                              )}
                              {subjectGroupAllocation && (
                                <div className="text-xs text-gray-500">
                                  교과 단위 설정 적용 중
                                </div>
                              )}
                              {!subjectGroupAllocation && source === "default" && (
                                <div className="text-xs text-gray-500">
                                  기본값 (취약과목)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 취약/전략 선택 UI */}
                        <AllocationControls
                          subjectType={contentSubjectType}
                          weeklyDays={contentWeeklyDays}
                          onChange={(allocation) => {
                            handleContentAllocationChange(content, allocation);
                          }}
                          disabled={!editable}
                          size="sm"
                        />
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

