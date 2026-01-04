/**
 * Wizard Feature - Public API
 *
 * 학생/관리자 위자드를 위한 공통 인프라스트럭처
 *
 * ## 개요
 *
 * 이 모듈은 4-Layer Context 패턴 기반의 위자드 시스템을 제공합니다:
 * - Data Context: 위자드 데이터 상태 및 업데이트
 * - Step Context: 단계 네비게이션
 * - Validation Context: 검증 상태 관리
 * - State Context: 전체 상태 접근 (레거시 지원)
 *
 * ## 사용 예시
 *
 * ### 1. 역할별 프로바이더 생성
 *
 * ```typescript
 * // student-wizard.ts
 * import {
 *   createWizardProvider,
 *   STUDENT_WIZARD_CONFIG,
 *   createDefaultStudentWizardData,
 * } from '@/lib/features/wizard';
 *
 * export const {
 *   WizardProvider: StudentWizardProvider,
 *   useWizardData,
 *   useWizardStep,
 *   useWizardValidation,
 * } = createWizardProvider(
 *   STUDENT_WIZARD_CONFIG,
 *   createDefaultStudentWizardData
 * );
 * ```
 *
 * ### 2. 컴포넌트에서 사용
 *
 * ```typescript
 * function Step1BasicInfo() {
 *   // 필요한 컨텍스트만 구독 → 성능 최적화
 *   const { wizardData, updateData } = useWizardData();
 *   const { currentStep, nextStep } = useWizardStep();
 *
 *   return (
 *     <form>
 *       <input
 *         value={wizardData.name}
 *         onChange={(e) => updateData({ name: e.target.value })}
 *       />
 *       <button onClick={nextStep}>다음</button>
 *     </form>
 *   );
 * }
 * ```
 *
 * @module lib/features/wizard
 */

// ============================================
// Types
// ============================================

export * from "./types";

// ============================================
// Context
// ============================================

export * from "./context";
