/**
 * 콘텐츠 마스터 모듈 공통 타입
 */

// 타입 재export (하위 호환성 유지)
export type {
  MasterBookFilters,
  MasterLectureFilters,
  MasterCustomContentFilters,
  ContentSortOption,
} from "@/lib/types/contentFilters";

/**
 * 통합 검색 필터 (하위 호환성)
 * @deprecated master_books, master_lectures로 분리됨. MasterBookFilters 또는 MasterLectureFilters 사용 권장
 */
export type ContentMasterFilters = {
  content_type?: "book" | "lecture";
  curriculum_revision_id?: string;
  subject_group_id?: string;
  subject_id?: string;
  publisher_id?: string; // 교재용
  platform_id?: string; // 강의용
  search?: string;
  difficulty?: string; // 난이도 필터링
  sort?: string; // 정렬 옵션
  tenantId?: string | null;
  limit?: number;
  offset?: number;
};
