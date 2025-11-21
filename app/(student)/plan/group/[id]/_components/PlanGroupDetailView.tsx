"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { PlanGroupDetailTabs } from "./PlanGroupDetailTabs";
import { Step1DetailView } from "./Step1DetailView";
import { Step2DetailView } from "./Step2DetailView";
import { Step2_5DetailView } from "./Step2_5DetailView";
import { Step3DetailView } from "./Step3DetailView";
import { Step4DetailView } from "./Step4DetailView";
import { Step6DetailView } from "./Step6DetailView";
import { Step7DetailView } from "./Step7DetailView";
import { GeneratePlansButton } from "./GeneratePlansButton";
import type { PlanGroup, PlanContent, PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import type { PlanScheduleViewRef } from "./PlanScheduleView";

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
        return <Step1DetailView group={group} />;
      case 2:
        return <Step2DetailView group={group} exclusions={exclusions} academySchedules={academySchedules} />;
      case 3:
        return <Step2_5DetailView group={group} exclusions={exclusions} academySchedules={academySchedules} />;
      case 4:
        return <Step3DetailView contents={studentContents} />;
      case 5:
        return <Step4DetailView contents={recommendedContents} />;
      case 6:
        return <Step6DetailView group={group} contents={contentsWithDetails} exclusions={exclusions} academySchedules={academySchedules} />;
      case 7:
        return (
          <Step7DetailView
            groupId={groupId}
            onScheduleViewReady={handleScheduleViewReady}
          />
        );
      default:
        return <Step1DetailView group={group} />;
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
        {renderTabContent()}
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
              currentStatus={group.status as any}
              onPlansGenerated={handlePlansGenerated}
            />
          </div>
        </div>
      )}
    </div>
  );
}

