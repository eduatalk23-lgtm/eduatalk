/**
 * Family Domain Types
 *
 * 가족/형제자매 관계 시스템의 타입 정의
 */

// ============================================
// Core Types
// ============================================

/**
 * 가족 그룹
 */
export type FamilyGroup = {
  id: string;
  tenantId: string;
  familyName: string | null;
  primaryContactParentId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
};

/**
 * 가족 멤버십 역할
 */
export type FamilyMembershipRole = "primary" | "member" | "guardian";

/**
 * 가족-학부모 멤버십
 */
export type FamilyParentMembership = {
  id: string;
  familyId: string;
  parentId: string;
  role: FamilyMembershipRole;
  createdAt: string;
};

/**
 * 가족 멤버 정보 (조회 시)
 */
export type FamilyMember = {
  id: string;
  type: "student" | "parent";
  name: string | null;
  role?: FamilyMembershipRole; // 부모인 경우에만
  relation?: string; // 학생-부모 관계 (father, mother 등)
};

/**
 * 학생 정보 (가족 조회 시)
 */
export type FamilyStudent = {
  id: string;
  name: string | null;
  grade: string | null;
  school: string | null;
};

/**
 * 학부모 정보 (가족 조회 시)
 */
export type FamilyParent = {
  id: string;
  name: string | null;
  email: string | null;
  role: FamilyMembershipRole;
};

/**
 * 가족 상세 정보 (멤버 포함)
 */
export type FamilyWithMembers = FamilyGroup & {
  students: FamilyStudent[];
  parents: FamilyParent[];
  primaryContactParent: FamilyParent | null;
};

/**
 * 가족 목록 아이템 (요약 정보)
 */
export type FamilyListItem = {
  id: string;
  familyName: string | null;
  tenantId: string;
  studentCount: number;
  parentCount: number;
  primaryContactName: string | null;
  createdAt: string;
};

// ============================================
// Sibling Detection Types
// ============================================

/**
 * 형제자매 후보 감지 소스
 */
export type SiblingCandidateSource =
  | "same_parent" // 같은 부모에 연결됨
  | "same_phone" // 같은 전화번호
  | "same_address" // 같은 주소 (추후 구현)
  | "manual"; // 수동 지정

/**
 * 형제자매 후보
 */
export type SiblingCandidate = {
  studentId: string;
  studentName: string | null;
  grade: string | null;
  source: SiblingCandidateSource;
  confidence: number; // 0-100
  sharedParentIds?: string[]; // same_parent인 경우
};

// ============================================
// Action Input Types
// ============================================

/**
 * 가족 생성 입력
 */
export type CreateFamilyInput = {
  familyName?: string;
  primaryContactParentId?: string;
  notes?: string;
  studentIds?: string[];
  parentIds?: string[];
};

/**
 * 가족 수정 입력
 */
export type UpdateFamilyInput = {
  familyName?: string | null;
  primaryContactParentId?: string | null;
  notes?: string | null;
};

/**
 * 가족 병합 입력
 */
export type MergeFamiliesInput = {
  primaryFamilyId: string;
  secondaryFamilyId: string;
};

// ============================================
// Action Result Types
// ============================================

/**
 * 기본 결과 타입
 */
export type FamilyActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

/**
 * 가족 생성 결과
 */
export type CreateFamilyResult = FamilyActionResult<{
  familyId: string;
}>;

/**
 * 가족 병합 결과
 */
export type MergeFamiliesResult = FamilyActionResult<{
  mergedFamilyId: string;
  movedStudentCount: number;
  movedParentCount: number;
}>;

/**
 * 형제자매 후보 검색 결과
 */
export type FindSiblingCandidatesResult = FamilyActionResult<{
  candidates: SiblingCandidate[];
}>;

// ============================================
// Query/Filter Types
// ============================================

/**
 * 가족 목록 필터
 */
export type FamilyListFilter = {
  tenantId?: string;
  search?: string;
  hasStudents?: boolean;
  hasParents?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * 페이지네이션 결과
 */
export type PaginatedResult<T> = {
  items: T[];
  totalCount: number;
  hasMore: boolean;
};
