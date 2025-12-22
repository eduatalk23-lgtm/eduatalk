/**
 * planGroupActions.ts - 플랜 그룹 관련 Server Actions
 *
 * 이 파일은 lib/domains/plan의 Server Actions를 re-export합니다.
 * 하위 호환성을 위해 유지됩니다.
 *
 * @deprecated lib/domains/plan에서 직접 import 사용을 권장합니다.
 */

export {
  // Create actions
  createPlanGroupAction,
  savePlanGroupDraftAction,
  copyPlanGroupAction,
  // Update actions
  updatePlanGroupDraftAction,
  updatePlanGroupAction,
  // Delete actions
  deletePlanGroupAction,
  // Status actions
  updatePlanGroupStatus,
  // Plan generation actions
  generatePlansFromGroupAction,
  previewPlansFromGroupAction,
  // Query actions
  getPlansByGroupIdAction,
  checkPlansExistAction,
  getScheduleResultDataAction,
  getActivePlanGroups,
  // Exclusion actions
  addPlanExclusion,
  deletePlanExclusion,
  syncTimeManagementExclusionsAction,
  // Academy actions
  addAcademySchedule,
  updateAcademySchedule,
  deleteAcademySchedule,
  getAcademySchedulesAction,
  createAcademy,
  updateAcademy,
  deleteAcademy,
  syncTimeManagementAcademySchedulesAction,
} from "@/lib/domains/plan";
