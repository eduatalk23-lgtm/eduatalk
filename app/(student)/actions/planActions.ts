/**
 * planActions.ts - 학생 플랜 관련 Server Actions
 *
 * 이 파일은 lib/domains/plan의 Server Actions를 re-export합니다.
 * 하위 호환성을 위해 유지됩니다.
 *
 * @deprecated lib/domains/plan에서 직접 import 사용을 권장합니다.
 */

export {
  createStudentPlanForm as createStudentPlan,
  updateStudentPlanForm as updateStudentPlan,
  deleteStudentPlanForm as deleteStudentPlan,
} from "@/lib/domains/plan";
