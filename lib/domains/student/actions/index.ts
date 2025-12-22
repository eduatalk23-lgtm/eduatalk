/**
 * Student Domain Actions
 *
 * Admin-facing Server Actions for student management.
 */

// ============================================
// Division Management (학생 구분)
// ============================================

export {
  // 학생 구분 할당 Actions
  updateStudentDivisionAction,
  getStudentsByDivisionAction,
  getStudentDivisionStatsAction,
  batchUpdateStudentDivisionAction,
  // 학생 구분 항목 관리 Actions
  getStudentDivisionsAction,
  getActiveStudentDivisionsAction,
  createStudentDivisionItemAction,
  updateStudentDivisionItemAction,
  deleteStudentDivisionItemAction,
  // Legacy 호환성
  createStudentDivisionAction,
  deleteStudentDivisionAction,
} from "./divisions";

// ============================================
// Student Management (학생 관리)
// ============================================

export {
  toggleStudentStatus,
  deleteStudent,
  bulkToggleStudentStatus,
  bulkDeleteStudents,
  updateStudentClass,
  updateStudentInfo,
  createStudent,
  regenerateConnectionCode,
  getStudentConnectionCode,
} from "./management";

// ============================================
// Parent Links (학부모 연결)
// ============================================

export {
  type StudentParent,
  type SearchableParent,
  type ParentRelation,
  type PendingLinkRequest,
  getStudentParents,
  searchParents,
  createParentStudentLink,
  deleteParentStudentLink,
  updateLinkRelation,
  getPendingLinkRequests,
  approveLinkRequest,
  rejectLinkRequest,
  approveLinkRequests,
  rejectLinkRequests,
} from "./parentLinks";

// ============================================
// Consulting Notes (상담 노트)
// ============================================

export {
  addConsultingNote,
  deleteConsultingNote,
} from "./consulting";
