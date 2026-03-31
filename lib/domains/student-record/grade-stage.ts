// ============================================
// 리포트 단계별 전환 시스템 — GradeStage 유틸리티
// 학년별 5단계 진행 상태 판정
// ============================================

import type { RecordTabData } from "./types";

/**
 * 학년별 기록 진행 단계
 *
 * prospective  - 수강 계획 기반 예상 방향 (기록 없음)
 * ai_draft     - AI가 생성한 초안만 존재 (ai_draft_content 있음, content 없음)
 * consultant   - 컨설턴트 가안 작성 중 (content 있음, confirmed_content 없음)
 * confirmed    - 확정된 내용 (confirmed_content 있음)
 * final        - NEIS 반영 최종본 (imported_content 있음)
 */
export type GradeStage =
  | "prospective"
  | "ai_draft"
  | "consultant"
  | "confirmed"
  | "final";

export interface GradeStageConfig {
  label: string;
  /** Tailwind 색상 접두사 (violet, blue, emerald, gray) */
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  description: string;
}

export const GRADE_STAGE_CONFIG: Record<GradeStage, GradeStageConfig> = {
  prospective: {
    label: "가상본",
    color: "violet",
    bgClass: "bg-violet-50 dark:bg-violet-950/20",
    textClass: "text-violet-700 dark:text-violet-300",
    borderClass: "border-violet-200 dark:border-violet-800",
    description: "수강 계획 기반 예상 방향",
  },
  ai_draft: {
    label: "AI 초안",
    color: "violet",
    bgClass: "bg-violet-50 dark:bg-violet-950/20",
    textClass: "text-violet-600 dark:text-violet-400",
    borderClass: "border-violet-200 dark:border-violet-800",
    description: "AI가 생성한 초안",
  },
  consultant: {
    label: "검토 중",
    color: "blue",
    bgClass: "bg-blue-50 dark:bg-blue-950/20",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-200 dark:border-blue-800",
    description: "컨설턴트 검토 진행 중",
  },
  confirmed: {
    label: "확정",
    color: "emerald",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/20",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    description: "확정된 내용",
  },
  final: {
    label: "최종",
    color: "gray",
    bgClass: "bg-white dark:bg-gray-900",
    textClass: "text-gray-900 dark:text-gray-100",
    borderClass: "border-gray-200 dark:border-gray-700",
    description: "NEIS 반영 최종본",
  },
};

/** 단계 순서 (낮은 인덱스 = 초기 단계) */
export const STAGE_ORDER: GradeStage[] = [
  "prospective",
  "ai_draft",
  "consultant",
  "confirmed",
  "final",
];

/** stage 인덱스 (0~4) */
export function getStageIndex(stage: GradeStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/** 해당 단계가 목표 단계 이상인지 */
export function isStageAtLeast(stage: GradeStage, target: GradeStage): boolean {
  return getStageIndex(stage) >= getStageIndex(target);
}

/**
 * RecordTabData 기반 학년 전체 stage 판정
 * 가장 높은 단계 기준으로 결정됨
 */
export function computeGradeStage(
  records: RecordTabData | undefined | null,
): GradeStage {
  if (!records) return "prospective";

  const allRecords: Array<{
    ai_draft_content?: string | null;
    content?: string | null;
    confirmed_content?: string | null;
    imported_content?: string | null;
  }> = [
    ...(records.seteks ?? []),
    ...(records.changche ?? []),
    ...(records.haengteuk ? [records.haengteuk] : []),
  ];

  if (allRecords.length === 0) return "prospective";

  if (allRecords.some((r) => r.imported_content?.trim())) return "final";
  if (allRecords.some((r) => r.confirmed_content?.trim())) return "confirmed";
  if (allRecords.some((r) => r.content?.trim())) return "consultant";
  if (allRecords.some((r) => r.ai_draft_content?.trim())) return "ai_draft";

  return "prospective";
}

/**
 * 단일 레코드 stage 판정
 * ContentSeparationFields 포함된 레코드 타입에 사용
 */
export function computeRecordStage(record: {
  ai_draft_content?: string | null;
  content?: string | null;
  confirmed_content?: string | null;
  imported_content?: string | null;
}): GradeStage {
  if (record.imported_content?.trim()) return "final";
  if (record.confirmed_content?.trim()) return "confirmed";
  if (record.content?.trim()) return "consultant";
  if (record.ai_draft_content?.trim()) return "ai_draft";
  return "prospective";
}

/**
 * stage 기반 0~100 완성도 추정 (진행률 바 표시용)
 * prospective=0, ai_draft=20, consultant=50, confirmed=80, final=100
 */
export const STAGE_COMPLETION: Record<GradeStage, number> = {
  prospective: 0,
  ai_draft: 20,
  consultant: 50,
  confirmed: 80,
  final: 100,
};
