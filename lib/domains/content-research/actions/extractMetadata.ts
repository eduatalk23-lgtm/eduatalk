"use server";

/**
 * AI 메타데이터 추출 서버 액션
 */

import { getAIMetadataExtractor, calculateOverallConfidence } from "../services/aiMetadataExtractor";
import type {
  ContentType,
  ExtractMetadataResult,
  ExtractedMetadata,
} from "../types";

/**
 * 단일 콘텐츠 메타데이터 추출
 */
export async function extractContentMetadata(
  title: string,
  contentType: ContentType,
  publisher?: string
): Promise<ExtractMetadataResult> {
  if (!title.trim()) {
    return {
      success: false,
      metadata: null,
      error: "제목을 입력해주세요",
    };
  }

  const extractor = getAIMetadataExtractor();
  const result = await extractor.extractFromTitle({
    title: title.trim(),
    contentType,
    publisher: publisher?.trim(),
  });

  return result;
}

/**
 * 배치 메타데이터 추출 (벌크 임포트용)
 */
export async function extractBatchMetadata(
  items: Array<{
    title: string;
    contentType: ContentType;
    publisher?: string;
  }>
): Promise<ExtractMetadataResult[]> {
  if (items.length === 0) {
    return [];
  }

  const extractor = getAIMetadataExtractor();
  const results = await extractor.extractBatch(
    items.map((item) => ({
      title: item.title,
      contentType: item.contentType,
      publisher: item.publisher,
    }))
  );

  return results;
}

/**
 * 메타데이터 품질 점수 계산
 */
export async function getMetadataQualityScore(
  metadata: ExtractedMetadata
): Promise<{
  overallScore: number;
  isComplete: boolean;
  missingFields: string[];
  recommendations: string[];
}> {
  const overallScore = calculateOverallConfidence(metadata);
  const missingFields: string[] = [];
  const recommendations: string[] = [];

  // 누락 필드 체크
  if (!metadata.subject || metadata.subjectConfidence < 0.6) {
    missingFields.push("subject");
    recommendations.push("과목을 직접 선택해주세요");
  }

  if (!metadata.subjectCategory || metadata.subjectCategoryConfidence < 0.6) {
    missingFields.push("subjectCategory");
    recommendations.push("과목 카테고리를 확인해주세요");
  }

  if (!metadata.difficulty || metadata.difficultyConfidence < 0.5) {
    missingFields.push("difficulty");
    recommendations.push("난이도를 선택해주세요");
  }

  if (metadata.gradeLevel.length === 0 || metadata.gradeLevelConfidence < 0.5) {
    missingFields.push("gradeLevel");
    recommendations.push("대상 학년을 선택해주세요");
  }

  return {
    overallScore,
    isComplete: missingFields.length === 0,
    missingFields,
    recommendations,
  };
}
