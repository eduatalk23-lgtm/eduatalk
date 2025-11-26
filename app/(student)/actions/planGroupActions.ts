"use server";

/**
 * planGroupActions.ts - 플랜 그룹 관련 Server Actions
 *
 * 이 파일은 모듈화된 함수들을 re-export하는 역할을 합니다.
 * 실제 구현은 plan-groups/ 디렉토리의 각 모듈에 있습니다.
 *
 * 모듈 구조:
 * - create.ts: 플랜 그룹 생성 관련 (createPlanGroupAction, savePlanGroupDraftAction, copyPlanGroupAction)
 * - update.ts: 플랜 그룹 업데이트 관련 (updatePlanGroupDraftAction, updatePlanGroupAction)
 * - delete.ts: 플랜 그룹 삭제 관련 (deletePlanGroupAction)
 * - status.ts: 플랜 그룹 상태 관리 관련 (updatePlanGroupStatus)
 * - plans.ts: 플랜 생성/미리보기 관련 (generatePlansFromGroupAction, previewPlansFromGroupAction)
 * - queries.ts: 조회 관련 (getPlansByGroupIdAction, checkPlansExistAction, getScheduleResultDataAction, getActivePlanGroups)
 * - exclusions.ts: 제외일 관련 (addPlanExclusion, deletePlanExclusion, syncTimeManagementExclusionsAction)
 * - academy.ts: 학원 관련 (addAcademySchedule, updateAcademySchedule, deleteAcademySchedule, getAcademySchedulesAction, createAcademy, updateAcademy, deleteAcademy, syncTimeManagementAcademySchedulesAction)
 * - utils.ts: 유틸리티 함수 (normalizePlanPurpose, timeToMinutes)
 */

// Create actions
export {
  createPlanGroupAction,
  savePlanGroupDraftAction,
  copyPlanGroupAction,
} from "./plan-groups/create";

// Update actions
export {
  updatePlanGroupDraftAction,
  updatePlanGroupAction,
} from "./plan-groups/update";

// Delete actions
export { deletePlanGroupAction } from "./plan-groups/delete";

// Status actions
export { updatePlanGroupStatus } from "./plan-groups/status";

// Plan generation actions
export {
  generatePlansFromGroupAction,
  previewPlansFromGroupAction,
} from "./plan-groups/plans";

// Query actions
export {
  getPlansByGroupIdAction,
  checkPlansExistAction,
  getScheduleResultDataAction,
  getActivePlanGroups,
} from "./plan-groups/queries";

// Exclusion actions
export {
  addPlanExclusion,
  deletePlanExclusion,
  syncTimeManagementExclusionsAction,
} from "./plan-groups/exclusions";

// Academy actions
export {
  addAcademySchedule,
  updateAcademySchedule,
  deleteAcademySchedule,
  getAcademySchedulesAction,
  createAcademy,
  updateAcademy,
  deleteAcademy,
  syncTimeManagementAcademySchedulesAction,
} from "./plan-groups/academy";
