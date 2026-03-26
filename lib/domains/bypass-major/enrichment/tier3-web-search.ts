// ============================================
// Tier 3: 웹 검색 + LLM 파싱 → 커리큘럼 추출
// "[대학] [학과] 교육과정 전공필수 전공선택" 검색 후 LLM으로 과목 구조화
// ============================================

import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { extractJson } from "@/lib/domains/student-record/llm/extractJson";
import type { ParsedCourse } from "./types";

const SYSTEM_PROMPT = `당신은 대학 교육과정 분석 전문가입니다.
웹 검색 결과에서 대학 학과의 교육과정(커리큘럼) 정보를 추출합니다.

## 규칙
1. 과목명, 과목 유형(전공필수/전공선택/전공기초/전공핵심/교양필수/교직), 학기를 추출합니다.
2. 과목 유형이 불명확하면 null로 표기합니다.
3. 실제 검색 결과에 있는 과목만 추출합니다. 추측하지 마세요.
4. JSON 배열로만 응답합니다.

## 출력 형식
\`\`\`json
{
  "courses": [
    { "courseName": "역학 1", "courseType": "전공필수", "semester": null },
    { "courseName": "데이터구조", "courseType": "전공선택", "semester": "2학년 1학기" }
  ],
  "confidence": 85
}
\`\`\``;

/**
 * 웹 검색 결과 텍스트에서 커리큘럼을 LLM으로 파싱.
 */
export async function parseWebSearchResults(
  universityName: string,
  departmentName: string,
  searchResultText: string,
): Promise<{ courses: ParsedCourse[]; confidence: number }> {
  if (!searchResultText || searchResultText.trim().length < 50) {
    return { courses: [], confidence: 0 };
  }

  const userPrompt = `## ${universityName} ${departmentName} 교육과정

아래 웹 검색 결과에서 이 학과의 교과목 목록을 추출해주세요.

---
${searchResultText.slice(0, 4000)}
---

과목명, 유형(전공필수/전공선택/전공기초/전공핵심/교양필수/교직), 학기를 JSON으로 추출하세요.`;

  const result = await generateTextWithRateLimit({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    modelTier: "fast",
    temperature: 0.1,
    maxTokens: 4000,
    responseFormat: "json",
  });

  if (!result.content) return { courses: [], confidence: 0 };

  const parsed = extractJson<{ courses?: Array<Record<string, unknown>>; confidence?: number }>(result.content);
  const courses: ParsedCourse[] = (parsed.courses ?? [])
    .filter((c) => typeof c.courseName === "string" && c.courseName.length > 0)
    .map((c) => ({
      courseName: String(c.courseName),
      courseType: typeof c.courseType === "string" ? c.courseType : null,
      semester: typeof c.semester === "string" ? c.semester : null,
    }));

  return {
    courses,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : (courses.length > 5 ? 80 : 50),
  };
}

/**
 * 웹 검색 쿼리 생성
 */
export function buildSearchQuery(universityName: string, departmentName: string): string {
  return `${universityName} ${departmentName} 교육과정 전공필수 전공선택 과목`;
}
