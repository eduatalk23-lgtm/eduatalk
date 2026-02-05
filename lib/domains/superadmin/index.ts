/**
 * Superadmin Domain
 *
 * 슈퍼관리자 관련 기능 모듈
 *
 * @module lib/domains/superadmin
 */

// Types
export type {
  TenantlessUser,
  UserType,
  TenantAssignment,
  Tenant,
  IncompleteSignupUser,
  CurriculumSetting,
  CurriculumSettingsData,
  TermsContentType,
  TermsContentInput,
  TermsContent,
} from "./types";

// Actions
export {
  // Tenantless Users
  getTenantlessUsers,
  assignTenantToUser,
  assignTenantToMultipleUsers,
  getActiveTenants,
  // Incomplete Signup Users
  getIncompleteSignupUsers,
  deleteIncompleteSignupUser,
  // Curriculum Settings
  getCurriculumSettings,
  updateCurriculumSettings,
  // Terms Contents
  createTermsContent,
  updateTermsContent,
  activateTermsContent,
  getTermsContents,
  getActiveTermsContent,
  getTermsContentById,
} from "./actions";
