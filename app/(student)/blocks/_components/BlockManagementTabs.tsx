"use client";

import BlockSetManagement from "./BlockSetManagement";
import ExclusionManagement from "./ExclusionManagement";
import AcademyScheduleManagement from "./AcademyScheduleManagement";
import type { PlanGroup } from "@/lib/types/plan";
import { tabButtonStyles, tabContainerStyles } from "@/lib/utils/darkMode";

export type ManagementTab = "blocks" | "exclusions" | "academy";

type BlockManagementTabsProps = {
  studentId: string;
  initialBlockSets?: Array<{ id: string; name: string; blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }> }>;
  initialActiveSetId?: string | null;
  initialBlocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string; block_set_id: string | null }>;
  initialPlanGroups?: PlanGroup[];
  activeTab: ManagementTab;
  onTabChange?: (tab: ManagementTab) => void;
  onBlockSetCreateRequest?: () => void;
  onExclusionAddRequest?: () => void;
  onAcademyAddRequest?: () => void;
  isCreatingBlockSet?: boolean;
  isAddingExclusion?: boolean;
  isAddingAcademy?: boolean;
};

export default function BlockManagementTabs({
  studentId,
  initialBlockSets = [],
  initialActiveSetId = null,
  initialBlocks = [],
  initialPlanGroups = [],
  activeTab,
  onTabChange,
  onBlockSetCreateRequest,
  onExclusionAddRequest,
  onAcademyAddRequest,
  isCreatingBlockSet = false,
  isAddingExclusion = false,
  isAddingAcademy = false,
}: BlockManagementTabsProps) {
  const handleTabChange = (tab: ManagementTab) => {
    onTabChange?.(tab);
  };

  const tabs: Array<{ key: ManagementTab; label: string }> = [
    { key: "blocks", label: "블록 세트" },
    { key: "exclusions", label: "학습 제외 일정" },
    { key: "academy", label: "학원 일정" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 탭 메뉴 */}
      <div className={tabContainerStyles}>
        <nav className="-mb-px flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={tabButtonStyles(activeTab === tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 내용 */}
      <div>
        {activeTab === "blocks" && (
          <BlockSetManagement
            studentId={studentId}
            initialBlockSets={initialBlockSets}
            initialActiveSetId={initialActiveSetId}
            initialBlocks={initialBlocks}
            onCreateSetRequest={onBlockSetCreateRequest}
            creating={isCreatingBlockSet}
          />
        )}
        {activeTab === "exclusions" && (
          <ExclusionManagement
            studentId={studentId}
            onAddRequest={onExclusionAddRequest}
            isAdding={isAddingExclusion}
          />
        )}
        {activeTab === "academy" && (
          <AcademyScheduleManagement
            studentId={studentId}
            onAddRequest={onAcademyAddRequest}
            isAddingAcademy={isAddingAcademy}
          />
        )}
      </div>
    </div>
  );
}

