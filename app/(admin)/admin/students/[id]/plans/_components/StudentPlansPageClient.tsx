"use client";

/**
 * StudentPlansPageClient
 *
 * 학생 플랜 관리 페이지의 클라이언트 컴포넌트
 * - 플래너 관리 (상단)
 * - 플랜 관리 (하단)
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/StudentPlansPageClient
 */

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { cn } from "@/lib/cn";
import { PlannerManagement } from "./PlannerManagement";
import { AdminPlanManagement } from "./AdminPlanManagement";
import type { Planner } from "@/lib/domains/admin-plan/actions";

interface StudentPlansPageClientProps {
  studentId: string;
  studentName: string;
  tenantId: string;
  initialDate: string;
  activePlanGroupId: string | null;
}

export function StudentPlansPageClient({
  studentId,
  studentName,
  tenantId,
  initialDate,
  activePlanGroupId,
}: StudentPlansPageClientProps) {
  // 플래너 관련 상태
  const [selectedPlanner, setSelectedPlanner] = useState<Planner | null>(null);
  const [isPlannerSectionOpen, setIsPlannerSectionOpen] = useState(true);

  // 플래너 선택 핸들러
  const handlePlannerSelect = useCallback((planner: Planner | null) => {
    setSelectedPlanner(planner);
  }, []);

  return (
    <div className="space-y-6">
      {/* 플래너 관리 섹션 (접을 수 있음) */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* 섹션 헤더 */}
        <button
          onClick={() => setIsPlannerSectionOpen(!isPlannerSectionOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">플래너 관리</span>
            {selectedPlanner && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                {selectedPlanner.name}
              </span>
            )}
          </div>
          {isPlannerSectionOpen ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {/* 플래너 관리 콘텐츠 */}
        <div
          className={cn(
            "transition-all duration-200 ease-in-out",
            isPlannerSectionOpen
              ? "max-h-[600px] opacity-100 p-4"
              : "max-h-0 opacity-0 overflow-hidden"
          )}
        >
          <PlannerManagement
            studentId={studentId}
            tenantId={tenantId}
            studentName={studentName}
            onPlannerSelect={handlePlannerSelect}
            selectedPlannerId={selectedPlanner?.id}
          />
        </div>
      </div>

      {/* 플랜 관리 섹션 */}
      <AdminPlanManagement
        studentId={studentId}
        studentName={studentName}
        tenantId={tenantId}
        initialDate={initialDate}
        activePlanGroupId={activePlanGroupId}
        selectedPlannerId={selectedPlanner?.id}
      />
    </div>
  );
}

export default StudentPlansPageClient;
