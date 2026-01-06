"use client";

/**
 * 플랜 생성 통합 섹션 메인 클라이언트 컴포넌트
 */

import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";
import { PlanCreationProvider, usePlanCreation } from "../_context/PlanCreationContext";
import { StudentSelectionSection } from "./student-selection/StudentSelectionSection";
import { MethodSelectionSection } from "./method-selection/MethodSelectionSection";
import { CreationFlowSection } from "./creation-flow/CreationFlowSection";
import { ResultsSection } from "./results/ResultsSection";

interface PlanCreationClientProps {
  students: StudentListRow[];
  isAdmin: boolean;
  initialSelectedIds?: string[];
}

export function PlanCreationClient({
  students,
  isAdmin,
  initialSelectedIds,
}: PlanCreationClientProps) {
  return (
    <PlanCreationProvider students={students} initialSelectedIds={initialSelectedIds}>
      <PlanCreationContent students={students} isAdmin={isAdmin} />
    </PlanCreationProvider>
  );
}

function PlanCreationContent({
  students,
  isAdmin,
}: PlanCreationClientProps) {
  const { currentStep, selectedStudentIds, selectedMethod, results } =
    usePlanCreation();

  return (
    <div className="flex flex-col gap-6">
      {/* Step 1: 학생 선택 */}
      <StudentSelectionSection students={students} />

      {/* Step 2: 방법 선택 (학생 선택 후 표시) */}
      {selectedStudentIds.size > 0 && (
        <MethodSelectionSection />
      )}

      {/* Step 3: 생성 플로우 (방법 선택 후 표시) */}
      {selectedMethod && currentStep === "creation-process" && (
        <CreationFlowSection />
      )}

      {/* Step 4: 결과 표시 */}
      {currentStep === "results" && results.length > 0 && (
        <ResultsSection />
      )}
    </div>
  );
}
