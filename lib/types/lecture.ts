/**
 * 강의 관련 TypeScript 타입 정의
 * 
 * @description 강의 스키마 리팩토링 후 타입 정의
 * @see docs/lecture-schema-refactoring.md
 * @updated 2024-11-29
 */

// ============================================
// Master Lectures (마스터 강의)
// ============================================

/**
 * 마스터 강의 데이터
 * - 공용 카탈로그 또는 테넌트 전용 커스텀 강의
 */
export interface MasterLecture {
  // ① 공통
  id: string;
  tenant_id?: string | null;  // null: 공용 카탈로그, not null: 테넌트 전용
  is_active: boolean;

  // ② 교육과정/교과 연계
  curriculum_revision_id?: string | null;
  subject_id?: string | null;
  grade_min?: number | null;  // 1-3
  grade_max?: number | null;  // 1-3
  school_type?: 'MIDDLE' | 'HIGH' | 'OTHER' | null;

  // ③ 기본 강의 정보
  title: string;
  subtitle?: string | null;
  series_name?: string | null;
  instructor?: string | null;
  platform_id?: string | null;        // 우선 사용 (FK to platforms)
  platform_name?: string | null;      // 레거시 (기존 platform)
  linked_book_id?: string | null;

  // ④ 회차/시간/난이도
  total_episodes: number;
  total_duration?: number | null;
  difficulty_level?: string | null;
  overall_difficulty?: number | null;
  target_exam_type?: string[] | null;

  // ⑤ 설명/텍스트/태그
  description?: string | null;
  toc?: string | null;
  tags?: string[] | null;

  // ⑥ 크롤링/외부 소스 메타
  source?: string | null;
  source_product_code?: string | null;
  source_url?: string | null;
  cover_image_url?: string | null;

  // ⑦ 파일/AI 분석 결과
  video_url?: string | null;
  transcript?: string | null;
  episode_analysis?: any | null;  // jsonb

  // ⑧ 레거시 컬럼 (호환성 유지)
  revision?: string | null;
  content_category?: string | null;
  // semester?: string | null; // 제거됨 (2025-02-04)
  subject?: string | null;           // TODO: subject_id 우선 사용
  subject_category?: string | null;

  // ⑨ 공통
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 마스터 강의 생성 요청
 */
export interface CreateMasterLectureRequest {
  tenant_id?: string | null;
  curriculum_revision_id?: string;
  subject_id?: string;
  grade_min?: number;
  grade_max?: number;
  school_type?: 'MIDDLE' | 'HIGH' | 'OTHER';
  
  title: string;
  subtitle?: string;
  series_name?: string;
  instructor?: string;
  platform_id?: string;
  linked_book_id?: string;
  
  total_episodes: number;
  total_duration?: number;
  difficulty_level?: string;
  target_exam_type?: string[];
  
  description?: string;
  toc?: string;
  tags?: string[];
  
  source?: string;
  source_product_code?: string;
  source_url?: string;
  cover_image_url?: string;
  
  notes?: string;
}

/**
 * 마스터 강의 수정 요청
 */
export type UpdateMasterLectureRequest = Partial<CreateMasterLectureRequest>;

// ============================================
// Lecture Episodes (마스터 강의 회차)
// ============================================

/**
 * 마스터 강의 회차
 */
export interface LectureEpisode {
  id: string;
  lecture_id: string;  // FK to master_lectures
  
  episode_number: number;
  episode_title?: string | null;
  duration?: number | null;
  display_order: number;
  
  // 회차별 난이도/태그
  difficulty_level?: string | null;
  difficulty_score?: number | null;
  tags?: string[] | null;
  lecture_source_url?: string | null;
  
  created_at: string;
}

/**
 * 강의 회차 생성 요청
 */
export interface CreateLectureEpisodeRequest {
  lecture_id: string;
  episode_number: number;
  title?: string;
  duration?: number;
  display_order: number;
  difficulty_level?: string;
  difficulty_score?: number;
  tags?: string[];
}

/**
 * 강의 회차 수정 요청
 */
export type UpdateLectureEpisodeRequest = Partial<Omit<CreateLectureEpisodeRequest, 'lecture_id'>>;

// ============================================
// Lectures (강의 인스턴스)
// ============================================

/**
 * 강의 인스턴스
 * - 학생/테넌트별 강의 인스턴스
 */
export interface Lecture {
  id: string;
  tenant_id: string;
  student_id?: string | null;
  
  master_lecture_id?: string | null;  // FK to master_lectures (기존 master_content_id)
  
  // 인스턴스용 표시 정보
  title?: string | null;
  nickname?: string | null;  // 사용자 정의 별명 (예: '6평 대비 패키지')
  notes?: string | null;
  
  // 진도/상태
  total_episodes?: number | null;
  completed_episodes?: number | null;
  progress?: number | null;  // 0-100
  
  linked_book_id?: string | null;
  
  // 레거시 컬럼 (호환성 유지, 향후 제거 예정)
  platform?: string | null;           // TODO: master_lectures.platform_name 사용
  subject?: string | null;            // TODO: master_lectures.subject 사용
  subject_category?: string | null;   // TODO: master_lectures.subject_category 사용
  revision?: string | null;           // TODO: master_lectures.revision 사용
  semester?: string | null;           // TODO: master_lectures.semester 사용
  chapter_info?: any | null;          // TODO: lecture_episodes 사용
  difficulty_level?: string | null;   // TODO: master_lectures.difficulty_level 사용
  latest_version?: string | null;     // 사용 안 함
  
  created_at: string;
  updated_at: string;
}

/**
 * 강의 인스턴스 생성 요청
 */
export interface CreateLectureRequest {
  tenant_id: string;
  student_id?: string;
  master_lecture_id?: string;
  
  title?: string;
  nickname?: string;
  notes?: string;
  
  total_episodes?: number;
  linked_book_id?: string;
}

/**
 * 강의 인스턴스 수정 요청
 */
export type UpdateLectureRequest = Partial<Omit<CreateLectureRequest, 'tenant_id'>>;

/**
 * 강의 진도 업데이트 요청
 */
export interface UpdateLectureProgressRequest {
  completed_episodes: number;
  progress: number;  // 0-100
}

// ============================================
// Student Lecture Episodes (학생 회차 진도)
// ============================================

/**
 * 학생 강의 회차 진도
 */
export interface StudentLectureEpisode {
  id: string;
  lecture_id: string;  // FK to lectures
  
  master_episode_id?: string | null;  // FK to lecture_episodes
  
  episode_number: number;
  episode_title: string | null;  // DB 컬럼명과 일치 (student_lecture_episodes.episode_title)
  duration?: number | null;
  display_order: number;
  
  // 진도/상태
  is_completed: boolean;
  watched_seconds: number;
  last_watched_at?: string | null;
  note?: string | null;
  
  created_at: string;
}

/**
 * 학생 회차 생성 요청
 */
export interface CreateStudentLectureEpisodeRequest {
  lecture_id: string;
  master_episode_id?: string;
  
  episode_number: number;
  episode_title?: string | null;  // DB 컬럼명과 일치
  duration?: number;
  display_order: number;
}

/**
 * 학생 회차 진도 업데이트 요청
 */
export interface UpdateStudentEpisodeProgressRequest {
  watched_seconds: number;
  is_completed: boolean;
  last_watched_at?: string;
  note?: string;
}

// ============================================
// JOIN 타입 (관계 포함)
// ============================================

/**
 * 마스터 강의 + 관계
 */
export interface MasterLectureWithRelations extends Omit<MasterLecture, 'subject' | 'platform'> {
  // 관계형 필드 (MasterLecture의 subject, platform 문자열 필드와 충돌 방지)
  curriculum_revision?: {
    id: string;
    name: string;
  } | null;
  subject?: {
    id: string;
    name: string;
  } | null;
  platform?: {
    id: string;
    name: string;
  } | null;
  linked_book?: {
    id: string;
    title: string;
  } | null;
  episodes?: LectureEpisode[];
}

/**
 * 강의 인스턴스 + 관계
 */
export interface LectureWithRelations extends Lecture {
  master_lecture?: MasterLecture | null;
  student?: {
    id: string;
    name: string;
  } | null;
  linked_book?: {
    id: string;
    title: string;
  } | null;
  episodes?: StudentLectureEpisode[];
}

/**
 * 학생 회차 + 관계
 */
export interface StudentLectureEpisodeWithRelations extends StudentLectureEpisode {
  master_episode?: LectureEpisode | null;
}

// ============================================
// 필터/검색 타입
// ============================================

/**
 * 마스터 강의 검색 필터
 */
export interface MasterLectureFilter {
  curriculum_revision_id?: string;
  subject_id?: string;
  grade_min?: number;
  grade_max?: number;
  school_type?: 'MIDDLE' | 'HIGH' | 'OTHER';
  platform_id?: string;
  difficulty_level?: string;
  target_exam_type?: string[];
  tags?: string[];
  is_active?: boolean;
  search?: string;  // title, instructor 검색
}

/**
 * 강의 인스턴스 검색 필터
 */
export interface LectureFilter {
  tenant_id?: string;
  student_id?: string;
  master_lecture_id?: string;
  search?: string;  // title, nickname 검색
}

// ============================================
// 응답 타입
// ============================================

/**
 * 페이지네이션 메타데이터
 */
export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

/**
 * 페이지네이션된 마스터 강의 응답
 */
export interface PaginatedMasterLecturesResponse {
  data: MasterLectureWithRelations[];
  meta: PaginationMeta;
}

/**
 * 페이지네이션된 강의 인스턴스 응답
 */
export interface PaginatedLecturesResponse {
  data: LectureWithRelations[];
  meta: PaginationMeta;
}

