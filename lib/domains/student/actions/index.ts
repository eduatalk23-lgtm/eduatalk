/**
 * Student Domain Actions
 *
 * Admin-facing and Student-facing Server Actions for student management.
 */

// ============================================
// Division Management (학부·학년 관리)
// ============================================

export {
  // 학부·학년 관리 Actions
  updateStudentDivisionAction,
  updateStudentGradeAction,
  getStudentsByDivisionAction,
  getStudentDivisionStatsAction,
  batchUpdateStudentDivisionAction,
  batchUpdateStudentGradeAction,
} from "./divisions";

// ============================================
// Student Management (학생 관리 - Admin)
// ============================================

export {
  toggleStudentStatus,
  deleteStudent,
  bulkToggleStudentStatus,
  bulkDeleteStudents,
  updateStudentClass,
  updateStudentInfo,
  createStudent,
} from "./management";

// ============================================
// Parent Links (학부모 연결)
// ============================================

export {
  type StudentParent,
  type SearchableParent,
  type ParentRelation,
  getStudentParents,
  searchParents,
  createParentStudentLink,
  deleteParentStudentLink,
  updateLinkRelation,
} from "./parentLinks";

// ============================================
// Consulting Notes (상담 노트)
// ============================================

export {
  addConsultingNote,
  deleteConsultingNote,
} from "./consulting";

// ============================================
// Student Profile (학생 프로필 - Student)
// ============================================

export {
  saveStudentInfo,
  updateStudentProfile,
  getCurrentStudent,
} from "./profile";

// ============================================
// Study Sessions (학습 세션 - Student)
// ============================================

export {
  startStudySession,
  endStudySession,
  cancelStudySession,
  pauseStudySession,
  resumeStudySession,
} from "./sessions";

// ============================================
// Notification Settings (알림 설정 - Student)
// ============================================

export {
  type NotificationSettings,
  updateNotificationSettings,
} from "./notifications";

// ============================================
// Student Search & Detail (학생 검색/상세 - Admin)
// ============================================

export {
  type StudentSearchItem,
  type SearchStudentsResult,
  searchStudentsAction,
} from "./search";

export {
  type StudentDetailResult,
  getStudentDetailAction,
} from "./detail";
