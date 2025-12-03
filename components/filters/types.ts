/**
 * 통합 콘텐츠 필터 타입 정의
 */

export type ContentFilterContext = "student" | "master" | "admin";
export type ContentType = "book" | "lecture";

export type CurriculumRevision = {
  id: string;
  name: string;
};

export type SubjectGroup = {
  id: string;
  name: string;
};

export type Subject = {
  id: string;
  name: string;
};

export type Publisher = {
  id: string;
  name: string;
};

export type Platform = {
  id: string;
  name: string;
};

export type UnifiedFilterValues = {
  // 계층형 필터
  curriculum_revision_id?: string;
  subject_group_id?: string;
  subject_id?: string;
  
  // 콘텐츠 타입별 필터
  publisher_id?: string; // 교재용
  platform_id?: string;  // 강의용
  
  // 검색 및 정렬
  search?: string;
  difficulty?: string;
  sort?: string;
};

export type UnifiedContentFilterProps = {
  // 기본 설정
  context: ContentFilterContext;
  contentType: ContentType;
  basePath: string;
  
  // 초기값
  initialValues?: Partial<UnifiedFilterValues>;
  
  // 필터 옵션
  filterOptions: {
    curriculumRevisions: CurriculumRevision[];
    publishers?: Publisher[];
    platforms?: Platform[];
    difficulties?: string[];
  };
  
  // 옵션 설정
  showDifficulty?: boolean; // 모든 페이지에서 true (기본값)
  showSort?: boolean; // 모든 페이지에서 true (기본값)
  
  // 정렬 옵션
  sortOptions?: Array<{
    value: string;
    label: string;
  }>;
  
  // 기본 정렬값 (페이지별로 다를 수 있음)
  defaultSort?: string;
  
  className?: string;
};

