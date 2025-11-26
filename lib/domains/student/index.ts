/**
 * Student 도메인 Public API
 *
 * 학생 정보 관련 기능을 통합합니다:
 * - 학생 기본 정보
 * - 학생 프로필
 * - 진로/진학 정보
 * - 학습 통계
 */

// 학생 기본 정보 re-export
export {
  getStudentById,
  listStudentsByTenant,
  upsertStudent,
  type Student,
} from "@/lib/data/students";

// 학생 프로필 re-export
export {
  getStudentProfile,
  upsertStudentProfile,
} from "@/lib/data/studentProfiles";

// 진로 목표 re-export
export {
  getStudentCareerGoals,
  upsertStudentCareerGoals,
} from "@/lib/data/studentCareerGoals";

// 진로 분야 선호도 re-export
export {
  getStudentCareerFieldPreferences,
  upsertStudentCareerFieldPreferences,
  deleteStudentCareerFieldPreference,
} from "@/lib/data/studentCareerFieldPreferences";

// 학습 통계 re-export
export {
  getStudentStats,
  updateStudentStats,
} from "@/lib/data/studentStats";

// 학습 세션 re-export
export {
  getStudentSessions,
  createStudentSession,
  updateStudentSession,
  endStudentSession,
} from "@/lib/data/studentSessions";

/**
 * 향후 마이그레이션 계획:
 *
 * 1. types.ts 추가
 *    - Student, StudentProfile, CareerGoal 타입 통합
 *
 * 2. validation.ts 추가
 *    - 학생 정보 수정 스키마
 *
 * 3. actions.ts 통합
 *    - app/(student)/actions/studentActions.ts
 *    - app/(student)/actions/accountActions.ts
 */

