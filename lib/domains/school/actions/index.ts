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

// Student Actions (학생용 학교 조회)
// Note: School 타입은 types.ts에서 이미 정의됨 - StudentSchool로 이름 변경
export {
  type School as StudentSchool,
  getSchoolById,
  getSchoolByName,
  searchSchools,
  autoRegisterSchool,
} from "./student";
