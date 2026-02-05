"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { PlanExclusion } from "@/lib/types/plan/domain";
import type { AcademyWithSchedules } from "@/lib/domains/admin-plan/actions/timeManagement";
import { AdminExclusionManagement } from "./AdminExclusionManagement";
import { AdminAcademyManagement } from "./AdminAcademyManagement";

type SubTab = "exclusion" | "academy";

interface TimeManagementSectionClientProps {
  studentId: string;
  initialExclusions: PlanExclusion[];
  initialAcademies: AcademyWithSchedules[];
}

export function TimeManagementSectionClient({
  studentId,
  initialExclusions,
  initialAcademies,
}: TimeManagementSectionClientProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("exclusion");

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {/* 서브탭 네비게이션 */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveSubTab("exclusion")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            activeSubTab === "exclusion"
              ? "border-b-2 border-indigo-500 text-indigo-600"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          학습 제외일
        </button>
        <button
          onClick={() => setActiveSubTab("academy")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            activeSubTab === "academy"
              ? "border-b-2 border-indigo-500 text-indigo-600"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          학원 일정
        </button>
      </div>

      {/* 콘텐츠 영역 */}
      {activeSubTab === "exclusion" ? (
        <AdminExclusionManagement
          studentId={studentId}
          initialExclusions={initialExclusions}
        />
      ) : (
        <AdminAcademyManagement
          studentId={studentId}
          initialAcademies={initialAcademies}
        />
      )}
    </div>
  );
}
