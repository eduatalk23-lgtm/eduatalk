"use client";

import { useState, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import { PlanGroupDetailTabs } from "./PlanGroupDetailTabs";
import { GeneratePlansButton } from "./GeneratePlansButton";
import { TabLoadingSkeleton } from "./TabLoadingSkeleton";
import { ErrorBoundary } from "./ErrorBoundary";
import type { PlanGroup, PlanContent, PlanExclusion, AcademySchedule, PlanStatus } from "@/lib/types/plan";
import type { PlanScheduleViewRef } from "./PlanScheduleView";

// 동적 임포트로 레이지 로딩 (named export를 default로 변환)
const Step1DetailView = lazy(() => 
  import("./Step1DetailView").then(module => ({ default: module.Step1DetailView }))
);
const Step2DetailView = lazy(() => 
  import("./Step2DetailView").then(module => ({ default: module.Step2DetailView }))
);
const Step2_5DetailView = lazy(() => 
  import("./Step2_5DetailView").then(module => ({ default: module.Step2_5DetailView }))
);
const Step3DetailView = lazy(() => 
  import("./Step3DetailView").then(module => ({ default: module.Step3DetailView }))
);
const Step4DetailView = lazy(() => 
  import("./Step4DetailView").then(module => ({ default: module.Step4DetailView }))
);
const Step6DetailView = lazy(() => 
  import("./Step6DetailView").then(module => ({ default: module.Step6DetailView }))
);
const Step7DetailView = lazy(() => 
  import("./Step7DetailView").then(module => ({ default: module.Step7DetailView }))
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
}: PlanGroupDetailViewProps) {
  const [currentTab, setCurrentTab] = useState(1);
  const scheduleViewRef = useRef<PlanScheduleViewRef | null>(null);

  // 탭 정보 메모이제이션
  const tabs = useMemo(() => [
    { id: 1, label: "기본 정보", completed: !!group.name && !!group.plan_purpose && !!group.scheduler_type },
    { id: 2, label: "블록 및 제외일", completed: !!group.block_set_id },
    { id: 3, label: "스케줄 미리보기", completed: true },
    { id: 4, label: "학생 콘텐츠", completed: contents.length > 0 },
    { id: 5, label: "추천 콘텐츠", completed: contentsWithDetails.some(c => c.isRecommended) },
    { id: 6, label: "최종 검토", completed: true },
    { id: 7, label: "스케줄 결과", completed: hasPlans },
  ], [group.name, group.plan_purpose, group.scheduler_type, group.block_set_id, contents.length, contentsWithDetails, hasPlans]);

  // 필터링된 콘텐츠 메모이제이션
  const studentContents = useMemo(() => 
    contentsWithDetails.filter(c => !c.isRecommended),
    [contentsWithDetails]
  );
  
  const recommendedContents = useMemo(() => 
    contentsWithDetails.filter(c => c.isRecommended),
    [contentsWithDetails]
  );

  // 탭 변경 핸들러 메모이제이션
  const handleTabChange = useCallback((tab: number) => {
    setCurrentTab(tab);
  }, []);

  // 스케줄 뷰 준비 핸들러 메모이제이션
  const handleScheduleViewReady = useCallback((ref: PlanScheduleViewRef | null) => {
    scheduleViewRef.current = ref;
  }, []);

  // 플랜 생성 후 콜백 메모이제이션
  const handlePlansGenerated = useCallback(() => {
    scheduleViewRef.current?.refresh();
  }, []);

  const renderTabContent = () => {
    switch (currentTab) {
      case 1:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step1DetailView group={group} />
          </Suspense>
        );
      case 2:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step2DetailView group={group} exclusions={exclusions} academySchedules={academySchedules} />
          </Suspense>
        );
      case 3:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step2_5DetailView group={group} exclusions={exclusions} academySchedules={academySchedules} />
          </Suspense>
        );
      case 4:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step3DetailView contents={studentContents} />
          </Suspense>
        );
      case 5:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step4DetailView contents={recommendedContents} />
          </Suspense>
        );
      case 6:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step6DetailView group={group} contents={contentsWithDetails} exclusions={exclusions} academySchedules={academySchedules} />
          </Suspense>
        );
      case 7:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step7DetailView
              groupId={groupId}
              onScheduleViewReady={handleScheduleViewReady}
            />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<TabLoadingSkeleton />}>
            <Step1DetailView group={group} />
          </Suspense>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PlanGroupDetailTabs
        currentTab={currentTab}
        onTabChange={handleTabChange}
        tabs={tabs}
      />
      
      <div className="mt-6">
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

      {/* 플랜 생성은 Step 7에서만 표시 */}
      {currentTab === 7 && (
        <div className="mt-8 border-t border-gray-200 pt-8">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">플랜 생성</h2>
            <p className="mb-4 text-sm text-gray-600">
              플랜 그룹 설정을 기반으로 개별 학습 플랜을 자동으로 생성합니다.
            </p>
            <GeneratePlansButton
              groupId={groupId}
              currentStatus={group.status as PlanStatus}
              onPlansGenerated={handlePlansGenerated}
            />
          </div>
        </div>
      )}
    </div>
  );
}

