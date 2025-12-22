/**
 * School Domain Actions
 */

// Core Actions (기존 actions.ts)
export {
  getSchoolsAction,
  getSchoolByIdAction,
  getSchoolByNameAction,
  searchSchoolsAction,
  getRegionsAction,
  getRegionsByLevelAction,
  getRegionsByParentAction,
  createSchoolAction,
  updateSchoolAction,
  deleteSchoolAction,
  autoRegisterSchoolAction,
} from "./core";

// Admin Actions (새 테이블 구조용)
export {
  getAllSchoolsAction,
  getSchoolInfoListAction,
  getUniversityCampusesAction,
  // Re-exports (override)
  searchSchoolsAction as searchAllSchoolsAction,
} from "./admin";
