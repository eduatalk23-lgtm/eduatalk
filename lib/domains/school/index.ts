/**
 * School 도메인 Public API
 *
 * 이 파일을 통해 school 도메인의 모든 기능에 접근할 수 있습니다.
 */

// 타입 내보내기
export type {
  School,
  SchoolType,
  SchoolSimple,
  Region,
  GetSchoolsOptions,
  GetRegionsOptions,
  CreateSchoolInput,
  UpdateSchoolInput,
  SchoolActionResult,
  HighSchoolCategory,
  UniversityType,
  UniversityOwnership,
} from "./types";

// 검증 스키마 내보내기
export {
  createSchoolSchema,
  updateSchoolSchema,
  schoolTypeSchema,
  highSchoolCategorySchema,
  universityTypeSchema,
  universityOwnershipSchema,
  postalCodeSchema,
} from "./validation";

export type {
  CreateSchoolFormData,
  UpdateSchoolFormData,
} from "./validation";

// 데이터 조회 함수 내보내기 (서버 컴포넌트에서 직접 사용)
export {
  getSchools,
  getSchoolById,
  getSchoolByName,
  getRegions,
  getRegionsByLevel,
  getRegionsByParent,
  checkSchoolDuplicate,
  validateRegionId,
} from "./queries";

// Server Actions 내보내기 (클라이언트 컴포넌트에서 사용)
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
  // 학생용 Actions
  autoRegisterSchoolAction,
} from "./actions";

