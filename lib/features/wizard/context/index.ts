/**
 * Wizard Context - Public API
 *
 * 4-Layer Context 패턴 기반 위자드 상태 관리
 *
 * @example
 * ```typescript
 * import { createWizardProvider } from '@/lib/features/wizard/context';
 * import { STUDENT_WIZARD_CONFIG, createDefaultStudentWizardData } from '@/lib/features/wizard/types';
 *
 * // 학생 위자드 프로바이더 생성
 * export const {
 *   WizardProvider: StudentWizardProvider,
 *   useWizardData,
 *   useWizardStep,
 *   useWizardValidation,
 * } = createWizardProvider(STUDENT_WIZARD_CONFIG, createDefaultStudentWizardData);
 * ```
 *
 * @module lib/features/wizard/context
 */

export { createWizardProvider } from "./createWizardProvider";
export { createWizardReducer } from "./createWizardReducer";
