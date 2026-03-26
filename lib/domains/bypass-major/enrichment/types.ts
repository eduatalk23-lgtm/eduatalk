// ============================================
// Phase C-2: 커리큘럼 확충 타입
// ============================================

export type CurriculumSource = "import" | "public_api" | "web_search" | "ai_inferred";

export interface EnrichmentResult {
  departmentId: string;
  tier: CurriculumSource;
  coursesAdded: number;
  confidence: number;
  cached: boolean; // true = 기존 데이터 재사용
}

export interface EnrichmentOptions {
  /** 최대 Tier 제한 (기본: 4) */
  maxTier?: 1 | 2 | 3 | 4;
  /** 강제 재수집 (stale 무시) */
  forceRefresh?: boolean;
  /** staleness 임계값 (일, 기본: 180) */
  stalenessThresholdDays?: number;
}

export interface ParsedCourse {
  courseName: string;
  courseType: string | null; // 전공필수, 전공선택, 교양필수 등
  semester: string | null;
}
