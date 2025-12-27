/**
 * 콘텐츠 도메인 유틸리티 함수
 */

import { FreeLearningItemInput } from './types';

// ============================================================
// 자연어 파싱
// ============================================================

/**
 * 자연어 입력에서 학습 아이템 정보 추출
 * 예: "수학 50-60쪽 30분" -> { title: "수학", rangeStart: "50", rangeEnd: "60", estimatedMinutes: 30 }
 */
export function parseNaturalInput(input: string): Partial<FreeLearningItemInput> {
  const result: Partial<FreeLearningItemInput> = {};

  // 시간 추출 (예: "30분", "1시간")
  const timeMatch = input.match(/(\d+)\s*(분|시간)/);
  if (timeMatch) {
    const value = parseInt(timeMatch[1], 10);
    const unit = timeMatch[2];
    result.estimatedMinutes = unit === '시간' ? value * 60 : value;
  }

  // 페이지 범위 추출 (예: "50-60쪽", "50~60페이지", "p50-60")
  const pageMatch = input.match(/(?:p)?(\d+)\s*[-~]\s*(\d+)\s*(?:쪽|페이지|p)?/i);
  if (pageMatch) {
    result.rangeType = 'page';
    result.rangeStart = pageMatch[1];
    result.rangeEnd = pageMatch[2];
    result.rangeUnit = '쪽';
  }

  // 단일 페이지 (예: "50쪽", "p50")
  if (!pageMatch) {
    const singlePageMatch = input.match(/(?:p)?(\d+)\s*(?:쪽|페이지|p)/i);
    if (singlePageMatch) {
      result.rangeType = 'page';
      result.rangeStart = singlePageMatch[1];
      result.rangeEnd = singlePageMatch[1];
      result.rangeUnit = '쪽';
    }
  }

  // 시간과 페이지 정보를 제외한 나머지를 제목으로
  let title = input
    .replace(/(\d+)\s*(분|시간)/g, '')
    .replace(/(?:p)?(\d+)\s*[-~]\s*(\d+)\s*(?:쪽|페이지|p)?/gi, '')
    .replace(/(?:p)?(\d+)\s*(?:쪽|페이지|p)/gi, '')
    .trim();

  if (title) {
    result.title = title;
  }

  return result;
}
