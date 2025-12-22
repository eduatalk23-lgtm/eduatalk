/**
 * Student 도메인 Public API
 *
 * 외부에서는 이 파일을 통해서만 student 도메인에 접근합니다.
 */

// ============================================
// Types
// ============================================

export * from "./types";

// ============================================
// Repository (읽기 전용 접근)
// ============================================

export {
  // Student 조회
  getStudentById,
  listStudentsByTenant,
  getActiveStudentsForSMS,
  // Student Division 조회
  getStudentsByDivision,
  getStudentDivisionStats,
  // Division 항목 조회
  getStudentDivisions,
  getActiveStudentDivisions,
  getStudentDivisionById,
  checkDivisionInUse,
} from "./repository";

export type { StudentDivisionItem } from "./repository";

// ============================================
// Actions (Server Actions)
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
} from "./actions";

/**
 * 사용 예시:
 *
 * // 학생 조회
 * import { getStudentById, listStudentsByTenant } from "@/lib/domains/student";
 * const student = await getStudentById(studentId);
 *
 * // 학생 구분 할당
 * import { updateStudentDivisionAction } from "@/lib/domains/student";
 * await updateStudentDivisionAction(studentId, "고등부");
 *
 * // 구분 항목 관리
 * import { createStudentDivisionItemAction } from "@/lib/domains/student";
 * await createStudentDivisionItemAction("신규 구분", 10);
 */
