/**
 * School 도메인 Public API
 *
 * 외부에서는 이 파일을 통해서만 school 도메인에 접근합니다.
 */

// Types
export * from "./types";

// Validation Schemas
export * from "./validation";

// Service (비즈니스 로직)
export * as service from "./service";

// Server Actions
export {
  // 조회 Actions
  getSchoolsAction,
  getSchoolByIdAction,
  getSchoolByNameAction,
  searchSchoolsAction,
  getRegionsAction,
  getRegionsByLevelAction,
  getRegionsByParentAction,
  // 관리자 Actions
  createSchoolAction,
  updateSchoolAction,
  deleteSchoolAction,
  // 학생 Actions
  autoRegisterSchoolAction,
} from "./actions";

// Repository는 외부에 노출하지 않음 (service를 통해 접근)
