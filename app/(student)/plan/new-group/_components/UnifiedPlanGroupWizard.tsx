"use client";

/**
 * UnifiedPlanGroupWizard
 *
 * Full 위저드(7단계)의 통합 시스템 기반 구현
 * UnifiedWizardProvider를 사용하면서 기존 PlanGroupWizard와의 호환성 유지
 *
 * @module app/(student)/plan/new-group/_components/UnifiedPlanGroupWizard
 */

import { useMemo, createContext, useContext, type ReactNode } from "react";
import {
  UnifiedWizardProvider,
  createFullWizardData,
  createFullModeValidators,
  type FullWizardData,
} from "@/lib/wizard";
import {
  useLegacyPlanWizardBridge,
  legacyToUnified,
  type LegacyPlanWizardBridge,
} from "@/lib/wizard/adapters";
import { PlanGroupWizard, type ExtendedInitialData } from "./PlanGroupWizard";
import type { WizardData } from "@/lib/schemas/planWizardSchema";

// ============================================
// 레거시 브릿지 컨텍스트
// ============================================

/**
 * 기존 컴포넌트들이 점진적으로 마이그레이션될 때까지
 * 레거시 API를 제공하는 컨텍스트
 */
const LegacyBridgeContext = createContext<LegacyPlanWizardBridge | null>(null);

/**
 * 레거시 브릿지 훅
 * 기존 usePlanWizard() 대신 사용 가능
 */
export function usePlanWizardBridge(): LegacyPlanWizardBridge {
  const bridge = useContext(LegacyBridgeContext);
  if (!bridge) {
    throw new Error(
      "usePlanWizardBridge must be used within UnifiedPlanGroupWizard"
    );
  }
  return bridge;
}

// ============================================
// 브릿지 프로바이더
// ============================================

interface LegacyBridgeProviderProps {
  children: ReactNode;
}

/**
 * 레거시 브릿지를 제공하는 내부 프로바이더
 * UnifiedWizardProvider 내부에서 사용
 */
function LegacyBridgeProvider({ children }: LegacyBridgeProviderProps) {
  const bridge = useLegacyPlanWizardBridge();

  return (
    <LegacyBridgeContext.Provider value={bridge}>
      {children}
    </LegacyBridgeContext.Provider>
  );
}

// ============================================
// 데이터 변환
// ============================================

/**
 * ExtendedInitialData를 FullWizardData로 변환
 */
function convertInitialData(initialData?: ExtendedInitialData): FullWizardData {
  if (!initialData) {
    return createFullWizardData({});
  }

  // ExtendedInitialData에서 WizardData 부분 추출
  const wizardData: Partial<WizardData> = {
    name: initialData.name,
    plan_purpose: initialData.plan_purpose,
    scheduler_type: initialData.scheduler_type,
    period_start: initialData.period_start,
    period_end: initialData.period_end,
    target_date: initialData.target_date,
    block_set_id: initialData.block_set_id,
    exclusions: initialData.exclusions,
    academy_schedules: initialData.academy_schedules,
    time_settings: initialData.time_settings,
    student_contents: initialData.student_contents,
    recommended_contents: initialData.recommended_contents,
    study_review_cycle: initialData.study_review_cycle,
    student_level: initialData.student_level,
    plan_type: initialData.plan_type,
    camp_template_id: initialData.camp_template_id,
    camp_invitation_id: initialData.camp_invitation_id,
  };

  // 레거시 데이터를 통합 형식으로 변환
  const unifiedData = legacyToUnified(wizardData as WizardData, "basic-info");

  // 추가 메타데이터 설정
  if (initialData.groupId) {
    unifiedData.meta.draftId = initialData.groupId;
  }

  return unifiedData;
}

// ============================================
// 메인 컴포넌트
// ============================================

interface UnifiedPlanGroupWizardProps {
  studentId: string;
  initialData?: ExtendedInitialData;
}

/**
 * UnifiedPlanGroupWizard
 *
 * 통합 위저드 시스템 기반의 Full 위저드 구현
 *
 * @example
 * ```tsx
 * <UnifiedPlanGroupWizard
 *   studentId="student-123"
 *   initialData={{ name: "내 학습 계획" }}
 * />
 * ```
 */
export function UnifiedPlanGroupWizard({
  studentId,
  initialData,
}: UnifiedPlanGroupWizardProps) {
  // 초기 데이터 변환 (한 번만 계산)
  const wizardData = useMemo(
    () => convertInitialData(initialData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // initialData는 초기 렌더링 시에만 사용
  );

  // 검증기 생성
  const validators = useMemo(() => createFullModeValidators(), []);

  return (
    <UnifiedWizardProvider<FullWizardData>
      initialData={wizardData}
      validators={validators}
    >
      <LegacyBridgeProvider>
        {/*
          현재는 기존 PlanGroupWizard를 그대로 사용합니다.
          향후 내부 컴포넌트들을 점진적으로 마이그레이션할 수 있습니다.

          마이그레이션 순서:
          1. Step1BasicInfo -> useWizard() 직접 사용
          2. Step2ScheduleSettings -> useWizard() 직접 사용
          3. ... 나머지 단계들
        */}
        <PlanGroupWizardContent
          studentId={studentId}
          initialData={initialData}
        />
      </LegacyBridgeProvider>
    </UnifiedWizardProvider>
  );
}

/**
 * 내부 컨텐츠 컴포넌트
 * 향후 개별 단계 컴포넌트로 분리하여 마이그레이션 가능
 */
function PlanGroupWizardContent({
  studentId,
  initialData,
}: {
  studentId: string;
  initialData?: ExtendedInitialData;
}) {
  // 현재는 기존 PlanGroupWizard를 그대로 렌더링
  // 향후 개별 Step 컴포넌트들을 통합 시스템 기반으로 교체 가능
  return <PlanGroupWizard studentId={studentId} initialData={initialData} />;
}

// ============================================
// 내보내기
// ============================================

export type { UnifiedPlanGroupWizardProps };
