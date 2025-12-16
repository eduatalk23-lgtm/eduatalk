/**
 * 콘텐츠 검색 필터 타입 정의
 * 
 * 공통 필터 타입과 콘텐츠 타입별 필터 타입을 정의합니다.
 */

/**
 * 기본 콘텐츠 필터 (모든 콘텐츠 타입에서 공통으로 사용)
 */
export type BaseContentFilters = {
  curriculum_revision_id?: string; // 개정교육과정 ID로 필터링
  subject_group_id?: string; // 교과 그룹 ID로 필터링
  subject_id?: string; // 과목 ID로 필터링
  search?: string; // 제목 검색
  difficulty?: string; // 난이도 필터링
  tenantId?: string | null; // 테넌트 ID (null이면 공개 콘텐츠만)
  sort?: ContentSortOption; // 정렬 옵션
  limit?: number; // 페이지 크기
  offset?: number; // 페이지 오프셋
};

/**
 * 교재 검색 필터
 */
export type MasterBookFilters = BaseContentFilters & {
  publisher_id?: string; // 출판사 ID로 필터링
};

/**
 * 강의 검색 필터
 */
export type MasterLectureFilters = BaseContentFilters & {
  platform_id?: string; // 플랫폼 ID로 필터링
};

/**
 * 커스텀 콘텐츠 검색 필터
 */
export type MasterCustomContentFilters = BaseContentFilters & {
  content_type?: string; // 콘텐츠 유형 필터링
};

/**
 * 콘텐츠 정렬 옵션
 */
export type ContentSortOption =
  | "title_asc"
  | "title_desc"
  | "difficulty_level_asc"
  | "difficulty_level_desc"
  | "created_at_asc"
  | "created_at_desc"
  | "updated_at_asc"
  | "updated_at_desc";

