// ============================================
// Tier 4: LLM 추론 — 학과명+계열에서 커리큘럼 추정
// 실제 데이터 없을 때 최후 수단 (confidence 낮음)
// ============================================

import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { extractJson } from "@/lib/domains/student-record/llm/extractJson";
import type { ParsedCourse } from "./types";

const SYSTEM_PROMPT = `당신은 한국 대학 교육과정 전문가입니다.
대학명, 학과명, 계열 정보를 바탕으로 해당 학과의 **예상 교육과정**을 추정합니다.

## 규칙
1. 해당 계열의 일반적인 커리큘럼을 기반으로 추정합니다.
2. 전공필수/전공선택/전공기초/교양필수 구분을 포함합니다.
3. 과목 수는 15~25개 범위로 추정합니다.
4. **추정임을 인지하세요** — 실제 교육과정과 다를 수 있습니다.
5. JSON으로만 응답합니다.

## 출력 형식
\`\`\`json
{
  "courses": [
    { "courseName": "일반물리학", "courseType": "전공기초", "semester": null },
    { "courseName": "역학", "courseType": "전공필수", "semester": null }
  ],
  "confidence": 50,
  "reasoning": "물리학과 일반 커리큘럼 기반 추정"
}
\`\`\``;

/**
 * 학과명 + 계열에서 예상 커리큘럼을 LLM으로 추론.
 */
export async function inferCurriculum(
  universityName: string,
  departmentName: string,
  classification: string | null,
): Promise<{ courses: ParsedCourse[]; confidence: number; reasoning: string }> {
  const userPrompt = `## 학과 정보
- 대학: ${universityName}
- 학과: ${departmentName}
- 계열: ${classification ?? "미분류"}

이 학과의 예상 교육과정(전공필수/선택/기초 과목)을 추정해주세요.
한국 대학의 일반적인 해당 계열 커리큘럼을 기반으로 합니다.`;

  const result = await generateTextWithRateLimit({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    modelTier: "fast",
    temperature: 0.2,
    maxTokens: 3000,
    responseFormat: "json",
  });

  if (!result.content) {
    return { courses: [], confidence: 0, reasoning: "AI 응답 없음" };
  }

  const parsed = extractJson<{
    courses?: Array<Record<string, unknown>>;
    confidence?: number;
    reasoning?: string;
  }>(result.content);

  const courses: ParsedCourse[] = (parsed.courses ?? [])
    .filter((c) => typeof c.courseName === "string" && c.courseName.length > 0)
    .map((c) => ({
      courseName: String(c.courseName),
      courseType: typeof c.courseType === "string" ? c.courseType : null,
      semester: typeof c.semester === "string" ? c.semester : null,
    }));

  return {
    courses,
    confidence: typeof parsed.confidence === "number"
      ? Math.min(parsed.confidence, 70) // 추론은 최대 70
      : (courses.length > 10 ? 50 : 30),
    reasoning: String(parsed.reasoning ?? `${departmentName} 계열 일반 추정`),
  };
}
