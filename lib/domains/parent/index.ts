/**
 * Parent Domain Public API
 *
 * 학부모 관련 기능을 통합합니다:
 * - 학생 연결 요청 관리
 * - 알림 설정 관리
 * - 학생 접근 권한 확인
 */

// Types
export type {
  StudentAttendanceNotificationSettings,
  SearchableStudent,
  LinkRequest,
  ParentRelation,
  LinkedStudent,
} from "./types";

// Actions
export {
  // Settings
  getStudentAttendanceNotificationSettings,
  updateStudentAttendanceNotificationSettings,
  // Link Requests
  searchStudentsForLink,
  createLinkRequest,
  getLinkRequests,
  cancelLinkRequest,
} from "./actions";

// Utils (for server-side use)
export { getLinkedStudents, canAccessStudent } from "./utils";
