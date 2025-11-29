"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import BlockManagementTabs, { type ManagementTab } from "./BlockManagementTabs";
import type { PlanGroup } from "@/lib/types/plan";

type BlockManagementContainerProps = {
  studentId: string;
  initialBlockSets?: Array<{ id: string; name: string; blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }> }>;
  initialActiveSetId?: string | null;
  initialBlocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string; block_set_id: string | null }>;
  initialPlanGroups?: PlanGroup[];
};

export default function BlockManagementContainer({
  studentId,
  initialBlockSets = [],
  initialActiveSetId = null,
  initialBlocks = [],
  initialPlanGroups = [],
}: BlockManagementContainerProps) {
  const [activeTab, setActiveTab] = useState<ManagementTab>("blocks");
  const [isCreatingBlockSet, setIsCreatingBlockSet] = useState(false);
  const [isAddingExclusion, setIsAddingExclusion] = useState(false);
  const [isAddingAcademy, setIsAddingAcademy] = useState(false);

  const handleBlockSetCreateRequest = () => {
    setIsCreatingBlockSet(!isCreatingBlockSet);
  };

  const handleExclusionAddRequest = () => {
    setIsAddingExclusion(!isAddingExclusion);
  };

  const handleAcademyAddRequest = () => {
    setIsAddingAcademy(!isAddingAcademy);
  };

  const getActionButton = () => {
    switch (activeTab) {
      case "blocks":
        if (initialBlockSets.length >= 5) return null;
        return (
          <button
            type="button"
            onClick={handleBlockSetCreateRequest}
            disabled={isCreatingBlockSet}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            새 블록 세트 추가
          </button>
        );
      case "exclusions":
        return (
          <button
            type="button"
            onClick={handleExclusionAddRequest}
            disabled={isAddingExclusion}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            제외일 추가
          </button>
        );
      case "academy":
        return (
          <button
            type="button"
            onClick={handleAcademyAddRequest}
            disabled={isAddingAcademy}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            학원 추가
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">시간 블록 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            블록 세트, 학습 제외 일정, 학원 일정을 관리할 수 있습니다.
          </p>
        </div>
        <div>{getActionButton()}</div>
      </div>

      <BlockManagementTabs
        studentId={studentId}
        initialBlockSets={initialBlockSets}
        initialActiveSetId={initialActiveSetId}
        initialBlocks={initialBlocks}
        initialPlanGroups={initialPlanGroups}
        onTabChange={setActiveTab}
        onBlockSetCreateRequest={handleBlockSetCreateRequest}
        onExclusionAddRequest={handleExclusionAddRequest}
        onAcademyAddRequest={handleAcademyAddRequest}
        isCreatingBlockSet={isCreatingBlockSet}
        isAddingExclusion={isAddingExclusion}
        isAddingAcademy={isAddingAcademy}
      />
    </>
  );
}

