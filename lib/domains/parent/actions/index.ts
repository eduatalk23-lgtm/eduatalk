/**
 * Parent Domain Actions
 */

// Settings Actions
export {
  getStudentAttendanceNotificationSettings,
  updateStudentAttendanceNotificationSettings,
} from "./settings";

// Link Request Actions
export {
  searchStudentsForLink,
  createLinkRequest,
  getLinkRequests,
  cancelLinkRequest,
} from "./linkRequests";

// Admin: Search
export { searchParentsAction } from "./search";
export type { SearchParentsResult } from "./search";

// Admin: Detail
export { getParentDetailAction } from "./detail";
export type { ParentDetailData, ParentDetailResult } from "./detail";

// Admin: Management
export {
  updateParentInfoAction,
  toggleParentStatusAction,
  deleteParentAction,
} from "./management";

// Admin: Linked Students
export { getLinkedStudentsByParentAction } from "./linkedStudents";
export type { LinkedStudentWithLinkId, GetLinkedStudentsResult } from "./linkedStudents";
