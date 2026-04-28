/**
 * 메타데이터 확신도 유틸리티 (client-safe)
 *
 * 순수 함수만 포함 — server-only 의존성 없음. Client Component 에서
 * 직접 import 해도 안전하도록 aiMetadataExtractor 서비스 파일과 분리한다.
 */

import type { ExtractedMetadata } from "../types";

export function calculateOverallConfidence(metadata: ExtractedMetadata): number {
  const weights = {
    subject: 0.25,
    subjectCategory: 0.15,
    difficulty: 0.25,
    gradeLevel: 0.15,
    curriculum: 0.1,
    lectureType: 0.1,
  };

  let score = 0;
  score += metadata.subjectConfidence * weights.subject;
  score += metadata.subjectCategoryConfidence * weights.subjectCategory;
  score += metadata.difficultyConfidence * weights.difficulty;
  score += metadata.gradeLevelConfidence * weights.gradeLevel;
  score += metadata.curriculumConfidence * weights.curriculum;
  score += (metadata.lectureTypeConfidence ?? 0) * weights.lectureType;

  return Math.round(score * 100) / 100;
}

export function isMetadataComplete(metadata: ExtractedMetadata): boolean {
  return (
    metadata.subject !== null &&
    metadata.subjectConfidence >= 0.6 &&
    metadata.subjectCategory !== null &&
    metadata.subjectCategoryConfidence >= 0.6 &&
    metadata.difficulty !== null &&
    metadata.difficultyConfidence >= 0.5
  );
}
