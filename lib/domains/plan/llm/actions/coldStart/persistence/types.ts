/**
 * 콜드 스타트 추천 결과 DB 저장 관련 타입
 */

import type { ContentType } from "../types";
import type { Json } from "@/lib/supabase/database.types";

/**
 * DB 저장 옵션
 */
export interface SaveRecommendationOptions {
  /** 테넌트 ID (null = 공유 카탈로그) */
  tenantId?: string | null;

  /** 교과 (예: 수학, 영어) */
  subjectCategory?: string;

  /** 과목 (예: 미적분, 영어독해) */
  subject?: string;

  /** 난이도 레벨 */
  difficultyLevel?: string;
}

/** 업데이트/스킵 이유 */
export type UpdateReason = "fill_metadata" | "quality_improvement" | "protected" | "no_improvement";

/**
 * 저장된 콘텐츠 항목 정보
 */
export interface SavedContentItem {
  /** 저장된 레코드 ID */
  id: string;

  /** 콘텐츠 제목 */
  title: string;

  /** 콘텐츠 타입 */
  contentType: ContentType;

  /** true: 새로 생성됨, false: 이미 존재하는 중복 */
  isNew: boolean;

  /** true: 기존 데이터가 업데이트됨 (품질 개선 또는 메타데이터 채움) */
  isUpdated?: boolean;

  /** 업데이트/스킵 이유 (기존 항목인 경우) */
  reason?: UpdateReason;
}

/**
 * 업데이트 이유별 통계
 */
export interface UpdateReasonStats {
  /** 메타데이터 채우기로 인한 업데이트 수 */
  fillMetadata: number;
  /** 품질 개선으로 인한 업데이트 수 */
  qualityImprovement: number;
}

/**
 * 스킵 이유별 통계
 */
export interface SkipReasonStats {
  /** 보호된 source로 인한 스킵 수 */
  protected: number;
  /** 품질 개선 없음으로 인한 스킵 수 */
  noImprovement: number;
}

/**
 * 저장 결과
 */
export interface SaveRecommendationsResult {
  /** 성공 여부 */
  success: boolean;

  /** 저장된 항목들 */
  savedItems: SavedContentItem[];

  /** 스킵된 중복 항목 수 */
  skippedDuplicates: number;

  /** 업데이트된 기존 항목 수 */
  updatedCount: number;

  /** 새로 생성된 항목 수 */
  newCount: number;

  /** 개별 항목 저장 에러 목록 */
  errors: Array<{ title: string; error: string }>;

  /** 업데이트 이유별 상세 통계 */
  updateReasons: UpdateReasonStats;

  /** 스킵 이유별 상세 통계 */
  skipReasons: SkipReasonStats;

  /** 강사 저장 결과 (강의 콘텐츠가 있는 경우) */
  instructorStats?: {
    /** 저장된 강사 수 */
    savedCount: number;
    /** 새로 생성된 강사 수 */
    newCount: number;
    /** 스킵된 중복 강사 수 */
    skippedDuplicates: number;
    /** 강의-강사 연결 수 */
    linkedLectures: number;
  };
}

/**
 * 중복 검사 결과
 */
export interface DuplicateCheckResult {
  /** 중복 여부 */
  isDuplicate: boolean;

  /** 기존 레코드 ID (중복인 경우) */
  existingId: string | null;
}

/**
 * 배치 중복 검사 결과
 */
export interface BatchDuplicateCheckResult {
  /** 제목 → 기존 ID 맵 (중복인 항목만 포함) */
  existingMap: Map<string, string>;

  /** 중복된 제목 목록 */
  duplicateTitles: string[];
}

/**
 * 기존 콘텐츠 정보 (조건부 업데이트 판단용)
 */
export interface ExistingContentInfo {
  /** 레코드 ID */
  id: string;

  /** 제목 */
  title: string;

  /** 데이터 소스 */
  source: string | null;

  /** 추천 메타데이터 존재 여부 */
  hasRecommendationMetadata: boolean;

  /** 품질 점수 (0-100) */
  qualityScore: number;

  /** 리뷰 점수 */
  reviewScore: number | null;

  /** 리뷰 수 */
  reviewCount: number;

  /** 콜드스타트 업데이트 횟수 */
  coldStartUpdateCount: number;
}

/**
 * 확장된 배치 중복 검사 결과 (조건부 업데이트용)
 */
export interface BatchDuplicateCheckResultWithDetails {
  /** 제목 → 기존 콘텐츠 정보 맵 (중복인 항목만 포함) */
  existingMap: Map<string, ExistingContentInfo>;

  /** 중복된 제목 목록 */
  duplicateTitles: string[];
}

/**
 * 교재 DB Insert 데이터 (cold_start용 최소 필드)
 */
export interface ColdStartBookInsert {
  tenant_id: string | null;
  title: string;
  total_pages: number | null;
  author: string | null;
  publisher_name: string | null;
  subject_category: string | null;
  subject: string | null;
  difficulty_level: string | null;
  notes: string | null;
  source: string;
  page_analysis: Json | null;
  is_active: boolean;
  // estimated_hours는 GENERATED 컬럼이므로 제외

  // 추천 근거 관련 컬럼
  /** 추천 메타데이터 (JSONB) */
  recommendation_metadata?: Json | null;
  /** 평균 리뷰 점수 (5점 만점) */
  review_score?: number | null;
  /** 총 리뷰 수 */
  review_count?: number;
  /** 추천 대상 학생 유형 */
  target_students?: string[];

  // 콜드스타트 추적 컬럼 (업데이트 시 사용)
  /** 마지막 콜드스타트 업데이트 시간 */
  cold_start_updated_at?: string | null;
  /** 콜드스타트 업데이트 횟수 */
  cold_start_update_count?: number;
}

/**
 * 강의 DB Insert 데이터 (cold_start용 최소 필드)
 */
export interface ColdStartLectureInsert {
  tenant_id: string | null;
  title: string;
  total_episodes: number;
  instructor_name: string | null;
  platform: string | null;
  subject_category: string | null;
  subject: string | null;
  difficulty_level: string | null;
  notes: string | null;
  episode_analysis: Json | null;
  // estimated_hours는 GENERATED 컬럼이므로 제외
  /** 총 소요시간 (분 단위) */
  total_duration?: number | null;

  // 추천 근거 관련 컬럼
  /** 추천 메타데이터 (JSONB) */
  recommendation_metadata?: Json | null;
  /** 평균 리뷰 점수 (5점 만점) */
  review_score?: number | null;
  /** 총 리뷰 수 */
  review_count?: number;
  /** 추천 대상 학생 유형 */
  target_students?: string[];

  // 콜드스타트 추적 컬럼 (업데이트 시 사용)
  /** 마지막 콜드스타트 업데이트 시간 */
  cold_start_updated_at?: string | null;
  /** 콜드스타트 업데이트 횟수 */
  cold_start_update_count?: number;
}

/**
 * 챕터 분석 데이터 (page_analysis / episode_analysis 저장용)
 * index signature를 추가하여 Supabase JSON 타입과 호환
 */
export interface ChapterAnalysisData {
  chapters: Array<{
    title: string;
    startRange: number;
    endRange: number;
    /** 해당 챕터/에피소드 소요시간 (분) */
    duration?: number;
  }>;
  source: "cold_start";
  createdAt: string;
  [key: string]: unknown;
}

// ============================================================================
// 강사 저장 관련 타입
// ============================================================================

/**
 * 강사 DB Insert 데이터 (cold_start용)
 */
export interface ColdStartInstructorInsert {
  tenant_id: string | null;
  name: string;
  platform: string | null;
  profile_summary: string | null;
  subject_categories: string[];
  subjects: string[];
  specialty: string | null;
  teaching_style: string | null;
  difficulty_focus: string | null;
  lecture_pace: string | null;
  explanation_style: string | null;
  review_score: number | null;
  review_count: number;
  target_students: string[];
  strengths: string[];
  weaknesses: string[];
  instructor_metadata: Json | null;
  source: string;
  is_active: boolean;
}

/**
 * 저장된 강사 항목 정보
 */
export interface SavedInstructorItem {
  /** 저장된 레코드 ID */
  id: string;

  /** 강사명 */
  name: string;

  /** 플랫폼 */
  platform: string | null;

  /** true: 새로 생성됨, false: 이미 존재하는 중복 */
  isNew: boolean;
}

/**
 * 강사 저장 결과
 */
export interface SaveInstructorsResult {
  /** 성공 여부 */
  success: boolean;

  /** 저장된 강사들 */
  savedInstructors: SavedInstructorItem[];

  /** 스킵된 중복 항목 수 */
  skippedDuplicates: number;

  /** 강의-강사 연결 수 */
  linkedLectures: number;

  /** 개별 항목 저장 에러 목록 */
  errors: Array<{ name: string; error: string }>;
}
