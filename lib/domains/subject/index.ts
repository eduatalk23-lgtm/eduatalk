/**
 * Subject 도메인 Public API
 *
 * 과목/교과 관련 기능을 통합합니다:
 * - 교과 그룹 관리
 * - 과목 관리
 * - 교육과정 개정판 관리
 */

// 과목 데이터 re-export
export {
  getSubjectGroups,
  getSubjects,
  getSubjectTypes,
  getSubjectById,
  getSubjectGroupById,
  getSubjectsByGroup,
} from "@/lib/data/subjects";

/**
 * 향후 마이그레이션 계획:
 *
 * 1. types.ts 추가
 *    - SubjectGroup, Subject, SubjectType 타입 통합
 *
 * 2. validation.ts 추가
 *    - 과목 생성/수정 스키마
 *
 * 3. actions.ts 통합
 *    - app/(admin)/actions/subjectActions.ts
 */

