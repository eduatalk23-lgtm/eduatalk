/**
 * Student 도메인 Repository
 *
 * 데이터 접근 계층을 담당합니다.
 * lib/data/students.ts를 래핑합니다.
 */

// Student 관련
export {
  getStudentById,
  listStudentsByTenant,
  upsertStudent,
  getActiveStudentsForSMS,
  // Division 관련 (학부·학년 관리)
  updateStudentDivision,
  updateStudentGrade,
  getStudentsByDivision,
  getStudentDivisionStats,
  batchUpdateStudentDivision,
  batchUpdateStudentGrade,
} from "@/lib/data/students";
