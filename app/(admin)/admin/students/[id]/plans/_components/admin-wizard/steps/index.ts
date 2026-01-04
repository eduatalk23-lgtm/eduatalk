/**
 * Admin Wizard Steps
 *
 * Phase 3: 7단계 위저드 Step 컴포넌트 모음
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps
 */

export { Step1BasicInfo } from "./Step1BasicInfo";
export { Step2TimeSettings } from "./Step2TimeSettings";
export { Step3SchedulePreview } from "./Step3SchedulePreview";
export { Step4ContentSelection } from "./Step4ContentSelection";
export { Step5AllocationSettings } from "./Step5AllocationSettings";
export { Step6FinalReview } from "./Step6FinalReview";
export { Step7GenerateResult } from "./Step7GenerateResult";

// Legacy exports (deprecated, will be removed)
// @deprecated Use Step1BasicInfo instead
export { Step1BasicInfoLegacy } from "./Step1BasicInfoLegacy";
// @deprecated Use Step4ContentSelection instead
export { Step2ContentSelection } from "./Step2ContentSelection";
// @deprecated Use Step6FinalReview instead
export { Step3ReviewCreate } from "./Step3ReviewCreate";
