/**
 * Superadmin Actions Index
 *
 * 슈퍼관리자 관련 Server Actions 모음
 */

// Tenantless Users Actions
export {
  getTenantlessUsers,
  assignTenantToUser,
  assignTenantToMultipleUsers,
  getActiveTenants,
} from "./tenantlessUsers";

// Curriculum Settings Actions
export { getCurriculumSettings, updateCurriculumSettings } from "./curriculumSettings";

// Terms Contents Actions
export {
  createTermsContent,
  updateTermsContent,
  activateTermsContent,
  getTermsContents,
  getActiveTermsContent,
  getTermsContentById,
} from "./terms";
