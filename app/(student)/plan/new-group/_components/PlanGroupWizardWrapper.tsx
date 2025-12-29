"use client";

/**
 * PlanGroupWizardWrapper
 *
 * Full 위저드(7단계)의 래퍼 컴포넌트
 * feature flag를 통해 기존 구현과 통합 시스템 간 전환 가능
 *
 * useUnifiedWizard=true: 통합 위저드 시스템 사용 (UnifiedWizardProvider 기반)
 * useUnifiedWizard=false: 기존 PlanGroupWizard 사용 (PlanWizardContext 기반)
 */

import { PlanGroupWizard, type ExtendedInitialData } from "./PlanGroupWizard";
import { UnifiedPlanGroupWizard } from "./UnifiedPlanGroupWizard";

interface PlanGroupWizardWrapperProps {
  studentId: string;
  initialData?: ExtendedInitialData;
  /** 통합 위저드 시스템 사용 여부 (기본값: false) */
  useUnifiedWizard?: boolean;
}

export function PlanGroupWizardWrapper({
  studentId,
  initialData,
  useUnifiedWizard = false,
}: PlanGroupWizardWrapperProps) {
  // 통합 위저드 시스템 사용
  if (useUnifiedWizard) {
    return (
      <UnifiedPlanGroupWizard studentId={studentId} initialData={initialData} />
    );
  }

  // 기존 위저드 사용 (기본값)
  return <PlanGroupWizard studentId={studentId} initialData={initialData} />;
}
