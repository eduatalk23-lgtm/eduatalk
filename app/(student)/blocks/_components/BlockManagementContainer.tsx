"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  
  const [activeTab, setActiveTab] = useState<ManagementTab>(() => {
    if (tabParam === "exclusions") return "exclusions";
    if (tabParam === "academy") return "academy";
    return "blocks";
  });
  const [isCreatingBlockSet, setIsCreatingBlockSet] = useState(false);
  const [isAddingExclusion, setIsAddingExclusion] = useState(false);
  const [isAddingAcademy, setIsAddingAcademy] = useState(false);

  // 쿼리 파라미터 변경 시 탭 전환
  useEffect(() => {
    if (tabParam === "exclusions") setActiveTab("exclusions");
    else if (tabParam === "academy") setActiveTab("academy");
    else if (tabParam === "blocks") setActiveTab("blocks");
  }, [tabParam]);

  // 탭 변경 시 URL 업데이트
  const handleTabChange = (tab: ManagementTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("tab", tab);
    router.push(`/blocks?${params.toString()}`);
  };

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
      <div className="mb-6">
        <SectionHeader
          level="h1"
          title="시간 블록 관리"
          description="블록 세트, 학습 제외 일정, 학원 일정을 관리할 수 있습니다."
          action={getActionButton()}
        />
      </div>

      <BlockManagementTabs
        studentId={studentId}
        initialBlockSets={initialBlockSets}
        initialActiveSetId={initialActiveSetId}
        initialBlocks={initialBlocks}
        initialPlanGroups={initialPlanGroups}
        activeTab={activeTab}
        onTabChange={handleTabChange}
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

