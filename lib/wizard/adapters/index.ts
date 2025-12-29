/**
 * 위저드 어댑터 모듈
 *
 * 레거시 위저드 시스템과 새로운 통합 위저드 시스템 간의 브릿지
 *
 * @module lib/wizard/adapters
 */

// Plan Wizard Adapter
export {
  useLegacyPlanWizardBridge,
  unifiedToLegacy,
  legacyToUnified,
  isLastStep,
  calculateProgress,
} from "./planWizardAdapter";

export type {
  WizardStep,
  LegacyPlanWizardState,
  LegacyPlanWizardActions,
  LegacyPlanWizardBridge,
} from "./planWizardAdapter";
