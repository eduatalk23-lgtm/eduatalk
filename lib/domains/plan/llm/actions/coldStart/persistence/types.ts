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

  /** 개별 항목 저장 에러 목록 */
  errors: Array<{ title: string; error: string }>;
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
  /** 총 예상 소요시간 (시간 단위) */
  estimated_hours?: number | null;
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
  /** 총 예상 소요시간 (시간 단위) */
  estimated_hours?: number | null;
  /** 총 소요시간 (분 단위) */
  total_duration?: number | null;
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
