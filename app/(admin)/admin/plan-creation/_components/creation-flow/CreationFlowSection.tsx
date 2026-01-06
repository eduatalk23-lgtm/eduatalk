"use client";

/**
 * 생성 플로우 섹션 컴포넌트
 * 선택된 방법에 따라 적절한 래퍼 컴포넌트를 렌더링
 */

import { cn } from "@/lib/cn";
import {
  bgSurface,
  textPrimary,
  textSecondary,
  borderInput,
} from "@/lib/utils/darkMode";
import { Cog } from "lucide-react";
import { useSelection, useFlow } from "../../_context/PlanCreationContext";
import { BatchAIPlanWrapper } from "./BatchAIPlanWrapper";
import { PlanGroupWizardWrapper } from "./PlanGroupWizardWrapper";
import { QuickPlanWrapper } from "./QuickPlanWrapper";
import { ContentWizardWrapper } from "./ContentWizardWrapper";

export function CreationFlowSection() {
  const { selectedMethod, selectedStudents } = useSelection();
  const { finishCreation, setStep, reset } = useFlow();

  const handleClose = () => {
    // 생성 취소 시 method-selection 단계로 돌아감
    setStep("method-selection");
  };

  const handleComplete = (results: Array<{
    studentId: string;
    studentName: string;
    status: "success" | "error" | "skipped";
    message?: string;
    planGroupId?: string;
  }>) => {
    finishCreation(results);
  };

  // 방법에 따른 래퍼 렌더링
  const renderWrapper = () => {
    switch (selectedMethod) {
      case "batch-ai":
        return (
          <BatchAIPlanWrapper
            selectedStudents={selectedStudents}
            isOpen={true}
            onClose={handleClose}
            onComplete={handleComplete}
          />
        );
      case "plan-group-wizard":
        return (
          <PlanGroupWizardWrapper
            selectedStudents={selectedStudents}
            isOpen={true}
            onClose={handleClose}
            onComplete={handleComplete}
          />
        );
      case "quick-plan":
        return (
          <QuickPlanWrapper
            selectedStudents={selectedStudents}
            isOpen={true}
            onClose={handleClose}
            onComplete={handleComplete}
          />
        );
      case "content-wizard":
        return (
          <ContentWizardWrapper
            selectedStudents={selectedStudents}
            isOpen={true}
            onClose={handleClose}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section
      className={cn(
        "rounded-xl border p-6",
        bgSurface,
        borderInput
      )}
    >
      {/* 섹션 헤더 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Cog className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className={cn("text-lg font-semibold", textPrimary)}>
            3단계: 플랜 생성
          </h2>
          <p className={cn("text-sm", textSecondary)}>
            {selectedStudents.length}명의 학생에게 플랜을 생성합니다
          </p>
        </div>
      </div>

      {/* 래퍼 컴포넌트 렌더링 영역 */}
      <div className="min-h-[400px]">
        {renderWrapper()}
      </div>
    </section>
  );
}
