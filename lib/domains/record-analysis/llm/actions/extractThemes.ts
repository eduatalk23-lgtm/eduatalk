"use server";

// ============================================
// H1 / L3-A: Cross-subject Theme Extractor 액션
// 학년 전체 레코드를 한 프롬프트에 일괄 분석 → 과목 교차 테마 추출
// ============================================

import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import {
  CROSS_SUBJECT_THEMES_SYSTEM_PROMPT,
  buildCrossSubjectThemesUserPrompt,
  parseCrossSubjectThemesResponse,
} from "../prompts/crossSubjectThemes";
import type {
  GradeThemeExtractionInput,
  GradeThemeExtractionResult,
} from "../types";

export interface ExtractThemesResponse {
  success: true;
  data: GradeThemeExtractionResult;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ExtractThemesError {
  success: false;
  error: string;
}

/** 단일 레코드 content 요약 (토큰 절감). 600자 초과 시 앞 400 + 뒤 200 */
function summarizeContent(content: string, maxChars = 600): string {
  if (content.length <= maxChars) return content;
  const head = content.slice(0, 400);
  const tail = content.slice(-200);
  return `${head}\n...(중략)...\n${tail}`;
}

/** 레코드 건수 과다 시 content 축약 적용 */
function prepareRecordsForPrompt(
  records: GradeThemeExtractionInput["records"],
): { records: GradeThemeExtractionInput["records"]; truncated: boolean } {
  if (records.length <= 12) return { records, truncated: false };
  const truncated = records.map((r) => ({
    ...r,
    content: summarizeContent(r.content, 400),
  }));
  return { records: truncated, truncated: true };
}

export async function extractCrossSubjectThemes(
  input: GradeThemeExtractionInput,
): Promise<ExtractThemesResponse | ExtractThemesError> {
  const startMs = Date.now();

  if (!input.records || input.records.length === 0) {
    return { success: false, error: "분석할 레코드가 없습니다." };
  }

  // 1건 레코드만 있으면 교차 테마 추출 불가
  if (input.records.length < 2) {
    return {
      success: true,
      data: {
        themes: [],
        themeCount: 0,
        crossSubjectPatternCount: 0,
        dominantThemeIds: [],
        elapsedMs: Date.now() - startMs,
      },
    };
  }

  const { records: preparedRecords, truncated } = prepareRecordsForPrompt(input.records);
  const userPrompt = buildCrossSubjectThemesUserPrompt({
    ...input,
    records: preparedRecords,
  });

  try {
    const result = await withRetry(
      () =>
        generateTextWithRateLimit({
          system: CROSS_SUBJECT_THEMES_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          // M1-c W6 (2026-04-27): advanced → fast.
          // 14 records × 550자 input + themes 6개 output 은 fast tier 충분.
          // phase route maxDuration 300s 안에 다른 pre-task 와 직렬 들어가야 함 → 응답 시간 단축 필수.
          // 메모리 LLM Actions 표: extractNarrativeArc (8단계 서사, 더 복잡) 도 fast 사용.
          modelTier: "fast",
          temperature: 0.3,
          maxTokens: 4000,
          responseFormat: "json",
        }),
      { label: "extractCrossSubjectThemes" },
    );

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    const parsed = parseCrossSubjectThemesResponse(result.content);

    return {
      success: true,
      data: {
        ...parsed,
        elapsedMs: Date.now() - startMs,
        ...(truncated ? { truncationWarning: true } : {}),
      },
      ...(result.usage ? { usage: result.usage } : {}),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
