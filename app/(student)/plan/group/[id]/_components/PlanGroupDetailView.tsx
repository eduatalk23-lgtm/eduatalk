"use client";

import { useState, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { PlanGroupDetailTabs } from "./PlanGroupDetailTabs";
import { GeneratePlansButton } from "./GeneratePlansButton";
import { TabLoadingSkeleton } from "./TabLoadingSkeleton";
import { ErrorBoundary } from "./ErrorBoundary";
import type { PlanGroup, PlanContent, PlanExclusion, AcademySchedule, PlanStatus } from "@/lib/types/plan";
import type { PlanScheduleViewRef } from "./PlanScheduleView";
import { planGroupToWizardData, contentsToWizardFormat } from "@/lib/utils/planGroupAdapters";

// 동적 임포트로 레이지 로딩 - 새로운 Step 컴포넌트 사용
const Step1BasicInfo = lazy(() => 
  import("@/app/(student)/plan/new-group/_components/Step1BasicInfo").then(module => ({ default: module.Step1BasicInfo }))
);
const Step2TimeSettings = lazy(() => 
  import("@/app/(student)/plan/new-group/_components/Step2TimeSettings").then(module => ({ default: module.Step2TimeSettings }))
);
const Step3ContentSelection = lazy(() => 
  import("@/app/(student)/plan/new-group/_components/Step3ContentSelection").then(module => ({ default: module.Step3ContentSelection }))
);
const Step6Simplified = lazy(() => 
  import("@/app/(student)/plan/new-group/_components/Step6Simplified").then(module => ({ default: module.Step6Simplified }))
);
const Step7ScheduleResult = lazy(() => 
  import("@/app/(student)/plan/new-group/_components/Step7ScheduleResult").then(module => ({ default: module.Step7ScheduleResult }))
);

type PlanGroupDetailViewProps = {
  group: PlanGroup;
  contents: PlanContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  contentsWithDetails: Array<PlanContent & {
    contentTitle: string;
    contentSubtitle: string | null;
    isRecommended: boolean;
  }>;
  canEdit: boolean;
  groupId: string;
  hasPlans?: boolean;
  campSubmissionMode?: boolean;
  templateBlocks?: Array<{
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
  templateBlockSetName?: string | null;
  templateBlockSetId?: string | null;
  blockSets?: Array<{
    id: string;
    name: string;
    blocks?: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  }>;
  campTemplateId?: string | null;
};

export function PlanGroupDetailView({
  group,
  contents,
  exclusions,
  academySchedules,
  contentsWithDetails,
  canEdit,
  groupId,
  hasPlans = false,
  campSubmissionMode = false,
  templateBlocks = [],
  templateBlockSetName = null,
  templateBlockSetId = null,
  blockSets = [],
  campTemplateId = null,
}: PlanGroupDetailViewProps) {
  const scheduleViewRef = useRef<PlanScheduleViewRef | null>(null);

  // 탭 정보 메모이제이션
  const allTabs = useMemo(() => [
    { id: 1, label: "기본 정보", completed: !!group.name && !!group.plan_purpose && !!group.scheduler_type },
    { id: 2, label: "블록 및 제외일", completed: !!group.block_set_id },
    { id: 4, label: "콘텐츠 선택", completed: contents.length > 0 }, // 학생 + 추천 통합
    { id: 6, label: "최종 검토", completed: true },
    { id: 7, label: "스케줄 결과", completed: hasPlans },
  ], [group.name, group.plan_purpose, group.scheduler_type, group.block_set_id, contents.length, hasPlans]);

  // 캠프 제출 모드일 때 탭 필터링 (1, 2, 4만 표시, 추천 콘텐츠 제외)
  const tabs = useMemo(() => {
    if (campSubmissionMode) {
      return allTabs.filter(tab => [1, 2, 4].includes(tab.id));
    }
    return allTabs;
  }, [allTabs, campSubmissionMode]);

  // 허용된 탭 ID 목록
  const allowedTabIds = useMemo(() => {
    if (campSubmissionMode) {
      return [1, 2, 4];
    }
    return [1, 2, 4, 6, 7]; // Step 3, 5 제거 (Step 2, 4에 통합)
  }, [campSubmissionMode]);

  // 초기 탭 설정 (허용된 탭 중 첫 번째)
  const initialTab = useMemo(() => {
    return allowedTabIds[0];
  }, [allowedTabIds]);

  const [currentTab, setCurrentTab] = useState(initialTab);

  // 필터링된 콘텐츠 메모이제이션
  const studentContents = useMemo(() => 
    contentsWithDetails.filter(c => !c.isRecommended),
    [contentsWithDetails]
  );
  
  const recommendedContents = useMemo(() => 
    contentsWithDetails.filter(c => c.isRecommended),
    [contentsWithDetails]
  );

  // 캠프 모드일 때 템플릿 블록 세트를 blockSets에 추가
  const enhancedBlockSets = useMemo(() => {
    if (campTemplateId && templateBlockSetId && templateBlockSetName && templateBlocks.length > 0) {
      // 템플릿 블록 세트가 이미 blockSets에 있는지 확인
      const existingIndex = blockSets.findIndex(bs => bs.id === templateBlockSetId);
      
      if (existingIndex >= 0) {
        // 이미 있으면 업데이트
        const updated = [...blockSets];
        updated[existingIndex] = {
          id: templateBlockSetId,
          name: templateBlockSetName,
          blocks: templateBlocks,
        };
        return updated;
      } else {
        // 없으면 맨 앞에 추가
        return [
          {
            id: templateBlockSetId,
            name: templateBlockSetName,
            blocks: templateBlocks,
          },
          ...blockSets,
        ];
      }
    }
    return blockSets;
  }, [campTemplateId, templateBlockSetId, templateBlockSetName, templateBlocks, blockSets]);

  // WizardData로 변환 (읽기 전용 모드용)
  const wizardData = useMemo(() => {
    const baseData = planGroupToWizardData(group, exclusions, academySchedules);
    const { studentContents: studentContentsFormatted, recommendedContents: recommendedContentsFormatted } = 
      contentsToWizardFormat(contentsWithDetails);
    
    // 캠프 모드일 때 템플릿 블록 세트 ID를 block_set_id로 설정
    const blockSetId = campTemplateId && templateBlockSetId 
      ? templateBlockSetId 
      : baseData.block_set_id;
    
    return {
      ...baseData,
      block_set_id: blockSetId,
      student_contents: studentContentsFormatted,
      recommended_contents: recommendedContentsFormatted,
    };
  }, [group, exclusions, academySchedules, contentsWithDetails, campTemplateId, templateBlockSetId]);

  // 탭 변경 핸들러 메모이제이션
  const handleTabChange = useCallback((tab: number) => {
    // 캠프 제출 모드일 때 허용되지 않은 탭으로 변경 시도 시 무시
    if (campSubmissionMode && !allowedTabIds.includes(tab)) {
      setCurrentTab(initialTab);
      return;
    }
    setCurrentTab(tab);
  }, [campSubmissionMode, allowedTabIds, initialTab]);

  // 스케줄 뷰 준비 핸들러 메모이제이션
  const handleScheduleViewReady = useCallback((ref: PlanScheduleViewRef | null) => {
    scheduleViewRef.current = ref;
  }, []);

  // 플랜 생성 후 콜백 메모이제이션
  const handlePlansGenerated = useCallback(() => {
    scheduleViewRef.current?.refresh();
  }, []);

  const renderTabContent = () => {
    // 캠프 제출 모드일 때 허용되지 않은 탭 접근 시 첫 번째 허용된 탭 콘텐츠 표시
    const displayTab = campSubmissionMode && !allowedTabIds.includes(currentTab) 
      ? initialTab 
      : currentTab;

    switch (displayTab) {
      case 1:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step1BasicInfo 
              data={wizardData}
              onUpdate={() => {}} // 읽기 전용 - 변경 불가
              blockSets={enhancedBlockSets}
              editable={false} // 완전히 읽기 전용
              isCampMode={!!campTemplateId} // 캠프 템플릿이 있으면 캠프 모드
              lockedFields={[]} // 읽기 전용이므로 모든 필드 잠금 불필요
            />
          </Suspense>
        );
      case 2:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step2TimeSettings 
              data={wizardData}
              onUpdate={() => {}} // 읽기 전용 - 변경 불가
              periodStart={group.period_start}
              periodEnd={group.period_end}
              editable={false} // 완전히 읽기 전용
              campMode={!!campTemplateId} // 캠프 템플릿이 있으면 캠프 모드 (제출 모드에서는 editable=false로 모든 필드 비활성화)
              isTemplateMode={false}
              studentId={group.student_id}
            />
          </Suspense>
        );
      case 4:
        // 콘텐츠 선택 (학생 + 추천 통합)
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step3ContentSelection 
              data={wizardData}
              onUpdate={() => {}} // 읽기 전용 - 변경 불가
              isCampMode={false} // 제출 모드에서는 editable=false로 모든 필드 비활성화
              isEditMode={false}
              studentId={group.student_id}
              editable={false} // 완전히 읽기 전용
            />
          </Suspense>
        );
      case 6:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step6Simplified 
              data={wizardData}
              onBack={() => {}}
              onNext={() => {}}
              editable={false} // 완전히 읽기 전용
              isCampMode={false} // 상세보기에서는 캠프 모드 체크 비활성화하여 모든 필드 비활성화
              isTemplateMode={false}
              studentId={group.student_id}
            />
          </Suspense>
        );
      case 7:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step7ScheduleResult
              groupId={groupId}
              onComplete={() => {}}
            />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step1BasicInfo 
              data={wizardData}
              onUpdate={() => {}} // 읽기 전용 - 변경 불가
              blockSets={enhancedBlockSets}
              editable={false} // 완전히 읽기 전용
              isCampMode={!!campTemplateId} // 캠프 템플릿이 있으면 캠프 모드
              lockedFields={[]}
            />
          </Suspense>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PlanGroupDetailTabs
        currentTab={currentTab}
        onTabChange={handleTabChange}
        tabs={tabs}
      />
      
      <div>
        <ErrorBoundary>
          <div
            role="tabpanel"
            id={`tabpanel-${currentTab}`}
            aria-labelledby={`tab-${currentTab}`}
          >
            {renderTabContent()}
          </div>
        </ErrorBoundary>
      </div>

      {/* 플랜 생성은 Step 7에서만 표시 (읽기 전용 모드에서는 숨김) */}
      {currentTab === 7 && canEdit && (
        <div className="border-t border-gray-200 pt-8">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-gray-900">플랜 생성</h2>
              <p className="text-sm text-gray-800">
                플랜 그룹 설정을 기반으로 개별 학습 플랜을 자동으로 생성합니다.
              </p>
              <GeneratePlansButton
                groupId={groupId}
                currentStatus={group.status as PlanStatus}
                onPlansGenerated={handlePlansGenerated}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

