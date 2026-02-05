/**
 * Family Domain Public API
 *
 * 가족/형제자매 관계 관리:
 * - 가족 그룹 CRUD
 * - 형제자매 관리
 * - 가족 멤버(학부모) 관리
 * - 가족 통합 로직
 */

// ============================================
// Types
// ============================================

export type {
  // Core types
  FamilyGroup,
  FamilyMembershipRole,
  FamilyParentMembership,
  FamilyMember,
  FamilyStudent,
  FamilyParent,
  FamilyWithMembers,
  FamilyListItem,
  // Sibling detection types
  SiblingCandidateSource,
  SiblingCandidate,
  // Input types
  CreateFamilyInput,
  UpdateFamilyInput,
  MergeFamiliesInput,
  // Result types
  FamilyActionResult,
  CreateFamilyResult,
  MergeFamiliesResult,
  FindSiblingCandidatesResult,
  // Query types
  FamilyListFilter,
  PaginatedResult,
} from "./types";

// ============================================
// Actions
// ============================================

// Family CRUD
export {
  createFamilyGroup,
  getFamilyWithMembers,
  listFamilies,
  updateFamilyGroup,
  deleteFamilyGroup,
} from "./actions/familyCrud";

// Sibling Actions
export {
  addStudentToFamily,
  removeStudentFromFamily,
  getSiblings,
  findSiblingCandidates,
  searchStudentsForSibling,
} from "./actions/siblingActions";

// Member Actions
export {
  addParentToFamily,
  removeParentFromFamily,
  updateParentRole,
} from "./actions/memberActions";

// Family Integration
export {
  handleParentLinkApproval,
  mergeFamilies,
} from "./actions/familyIntegration";
