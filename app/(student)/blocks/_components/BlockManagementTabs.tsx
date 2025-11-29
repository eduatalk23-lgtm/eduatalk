"use client";

import BlockSetManagement from "./BlockSetManagement";
import ExclusionManagement from "./ExclusionManagement";
import AcademyScheduleManagement from "./AcademyScheduleManagement";
import type { PlanGroup } from "@/lib/types/plan";

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

  return (
    <>
      {/* 탭 메뉴 */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-4">
          <button
            type="button"
            onClick={() => handleTabChange("blocks")}
            className={`border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
              activeTab === "blocks"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            블록 세트
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("exclusions")}
            className={`border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
              activeTab === "exclusions"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            학습 제외 일정
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("academy")}
            className={`border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
              activeTab === "academy"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            학원 일정
          </button>
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
    </>
  );
}

