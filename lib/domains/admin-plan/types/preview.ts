/**
 * 배치 플랜 미리보기 타입
 *
 * Phase 3: 미리보기 모드
 *
 * @module lib/domains/admin-plan/types/preview
 */

import type { GeneratedPlanItem } from "@/lib/domains/plan/llm/types";
import type { ValidationResult } from "@/lib/domains/plan/llm/validators/planValidator";

// ============================================
// 학생별 미리보기 결과
// ============================================

/**
 * 개별 학생의 플랜 미리보기 결과
 */
export interface StudentPlanPreview {
  studentId: string;
  studentName: string;
  /** 미리보기 상태 */
  status: "success" | "error" | "skipped";
  /** 생성된 플랜 (DB 저장 전) */
  plans?: GeneratedPlanItem[];
  /** 플랜 요약 */
  summary?: {
    totalPlans: number;
    totalMinutes: number;
    dateRange: {
      start: string;
      end: string;
    };
    subjectDistribution: Record<string, number>;
  };
  /** 품질 점수 */
  qualityScore?: QualityScore;
  /** 검증 결과 */
  validation?: ValidationResult;
  /** 비용 추정 */
  cost?: {
    inputTokens: number;
    outputTokens: number;
    estimatedUSD: number;
  };
  /** 에러 메시지 */
  error?: string;
}

/**
 * 품질 점수
 */
export interface QualityScore {
  /** 전체 점수 (0-100) */
  overall: number;
  /** 과목 균형 점수 (0-100) */
  balance: number;
  /** 충돌 수 (0 = 최상) */
  conflicts: number;
  /** 콘텐츠 커버리지 (0-100%) */
  coverage: number;
  /** 일일 학습량 분포 점수 (0-100) */
  pacing: number;
}

// ============================================
// 배치 미리보기 결과
// ============================================

/**
 * 배치 미리보기 전체 결과
 */
export interface BatchPreviewResult {
  success: boolean;
  /** 학생별 미리보기 결과 */
  previews: StudentPlanPreview[];
  /** 전체 요약 */
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
    totalPlans: number;
    totalCost: number;
    averageQualityScore: number;
  };
  error?: string;
}

// ============================================
// 미리보기 → 저장 입력
// ============================================

/**
 * 미리보기에서 저장으로 전환 시 입력
 */
export interface PreviewToSaveInput {
  /** 저장할 학생 ID 목록 (선택 해제된 학생 제외) */
  studentIds: string[];
  /** 미리보기 결과 (캐시된 플랜 데이터 포함) */
  previews: StudentPlanPreview[];
  /** 플랜 그룹 이름 템플릿 */
  planGroupNameTemplate: string;
}

/**
 * 저장 결과
 */
export interface PreviewSaveResult {
  success: boolean;
  results: Array<{
    studentId: string;
    studentName: string;
    planGroupId?: string;
    status: "success" | "error";
    error?: string;
  }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}
