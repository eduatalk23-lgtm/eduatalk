/**
 * A-L2 Coherence Checker — Flash 모델로 섹션 간 교차 참조 검증
 *
 * Deterministic Validator(A-L1)가 구조/수치를 검사한다면,
 * 이 모듈은 의미적 일관성을 LLM으로 검증합니다.
 *
 * 6개 교차 참조 규칙:
 * 1. OUTLINE_PROSE_ALIGNMENT — outline 대주제가 산문에 실제로 다뤄졌는지
 * 2. MOTIVATION_CONCLUSION_LINK — 동기에서 제기한 질문이 결론/제언에서 답변되는지
 * 3. BOOK_CONTENT_CONSISTENCY — (reading) 참고 도서 내용과 본문 주장이 모순 없는지
 * 4. SETEK_GUIDE_ALIGNMENT — 세특 예시가 가이드 내용과 일관되는지
 * 5. THEORY_FLOW_CONTINUITY — 이론 섹션 간 논리적 흐름이 자연스러운지
 * 6. FOLLOW_UP_RELEVANCE — 후속 탐구가 본문 내용에서 자연스럽게 도출되는지
 *
 * @since c3.3-v1
 */

import { generateObjectWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { zodSchema } from "ai";
import { z } from "zod";
import type { GeneratedGuideOutput } from "../types";
import type { Violation, ViolationSeverity } from "./deterministic-validator";

// ============================================================
// Types
// ============================================================

export interface CoherenceCheckResult {
  /** 모든 error 없이 통과했는지 */
  passed: boolean;
  /** LLM이 감지한 위반 목록 */
  violations: Violation[];
  errorCount: number;
  warningCount: number;
  /** Flash 모델 사용 토큰 */
  usage: { inputTokens: number; outputTokens: number };
}

// ============================================================
// LLM 응답 스키마
// ============================================================

const coherenceViolationSchema = z.object({
  rule: z
    .enum([
      "OUTLINE_PROSE_ALIGNMENT",
      "MOTIVATION_CONCLUSION_LINK",
      "BOOK_CONTENT_CONSISTENCY",
      "SETEK_GUIDE_ALIGNMENT",
      "THEORY_FLOW_CONTINUITY",
      "FOLLOW_UP_RELEVANCE",
    ])
    .describe("위반된 규칙 ID"),
  severity: z
    .enum(["error", "warning"])
    .describe("심각도: error=재생성 필요, warning=개선 권장"),
  message: z.string().describe("구체적 위반 설명 (한국어, 1~2문장)"),
  sectionKey: z
    .string()
    .optional()
    .describe("위반과 관련된 주 섹션 key"),
});

const coherenceResponseSchema = z.object({
  violations: z
    .array(coherenceViolationSchema)
    .describe("감지된 교차 참조 위반 목록. 위반이 없으면 빈 배열"),
});

type CoherenceResponse = z.infer<typeof coherenceResponseSchema>;

// ============================================================
// 프롬프트
// ============================================================

const SYSTEM_PROMPT = `당신은 고등학생 탐구 가이드의 품질 검수 전문가입니다.
주어진 가이드 출력을 분석하여 섹션 간 교차 참조 일관성만 검사하세요.

## 검사 규칙 6가지

1. **OUTLINE_PROSE_ALIGNMENT**: outline의 depth=0 대주제가 산문(content) 본문에서 실제로 다뤄지는지 확인.
   - error: 대주제가 산문에서 전혀 언급되지 않거나 1문장 이하로만 다뤄진 경우
   - warning: 대주제 내용이 산문에서 피상적으로만 다뤄진 경우

2. **MOTIVATION_CONCLUSION_LINK**: 탐구 동기(motivation)에서 제기한 핵심 질문/호기심이 결론(reflection/summary/follow_up)에서 답변 또는 발전되는지 확인.
   - error: 동기의 핵심 질문이 결론 영역에서 완전히 무시된 경우
   - warning: 답변이 피상적이거나 간접적으로만 연결된 경우

3. **BOOK_CONTENT_CONSISTENCY** (reading 타입 전용): 참고 도서(bookTitle)의 알려진 내용/관점과 본문 주장이 모순되는지 확인.
   - error: 도서의 명확한 주장과 정반대 내용을 서술한 경우
   - warning: 도서 내용을 과도하게 단순화하거나 맥락을 무시한 경우
   - 도서를 모르면 이 규칙은 건너뜁니다

4. **SETEK_GUIDE_ALIGNMENT**: 세특 예시(setek_examples)가 가이드의 실제 탐구 내용과 일관되는지 확인.
   - error: 세특 예시가 가이드와 무관한 활동을 서술한 경우
   - warning: 세특 예시가 가이드 내용을 부정확하게 반영한 경우

5. **THEORY_FLOW_CONTINUITY**: 이론 섹션(content_sections)이 여러 개일 때, 섹션 간 논리적 흐름이 자연스러운지 확인.
   - error: 이전 섹션의 결론과 다음 섹션의 전제가 모순되는 경우
   - warning: 섹션 간 전환이 갑작스럽거나 연결 논리가 부족한 경우
   - content_sections가 1개뿐이면 이 규칙은 건너뜁니다

6. **FOLLOW_UP_RELEVANCE**: 후속 탐구(follow_up)가 본문 탐구 내용에서 자연스럽게 도출되는지 확인.
   - error: 후속 탐구가 본문과 전혀 무관한 주제를 제안한 경우
   - warning: 연결이 약하거나 비약이 있는 경우
   - follow_up 섹션이 없으면 건너뜁니다

## 출력 지침

- 위반이 없으면 violations를 빈 배열로 반환하세요.
- 각 위반의 message는 구체적이어야 합니다 (어떤 내용이 어디서 불일치하는지 명시).
- 불확실한 위반은 보고하지 마세요. 명확한 경우만 보고합니다.
- severity 판단 기준: 학생이 이 가이드로 탐구를 진행했을 때 혼란이나 오류가 생기면 error, 아쉽지만 진행 가능하면 warning.`;

function buildUserPrompt(generated: GeneratedGuideOutput): string {
  const parts: string[] = [];

  parts.push(`# 가이드 검증 대상\n`);
  parts.push(`**제목**: ${generated.title}`);
  parts.push(`**유형**: ${generated.guideType}`);

  if (generated.bookTitle) {
    parts.push(
      `**참고 도서**: ${generated.bookTitle}${generated.bookAuthor ? ` (${generated.bookAuthor})` : ""}`,
    );
  }

  parts.push(`\n## 섹션 내용\n`);

  for (const section of generated.sections) {
    parts.push(`### [${section.key}] ${section.label}`);

    // outline 요약 (대주제만)
    if (section.outline?.length) {
      const depth0 = section.outline.filter((o) => o.depth === 0);
      if (depth0.length > 0) {
        parts.push(`**Outline 대주제**: ${depth0.map((o) => o.text).join(" / ")}`);
      }
    }

    // 산문 (길면 앞뒤 500자)
    const stripped = section.content.replace(/<[^>]*>/g, "").trim();
    if (stripped.length > 1200) {
      parts.push(
        `**산문** (앞 600자): ${stripped.slice(0, 600)}...`,
      );
      parts.push(
        `**산문** (뒤 600자): ...${stripped.slice(-600)}`,
      );
    } else {
      parts.push(`**산문**: ${stripped}`);
    }

    // items (세특 예시 등)
    if (section.items?.length) {
      parts.push(
        `**항목**: ${section.items.map((item) => item.replace(/<[^>]*>/g, "").slice(0, 200)).join(" | ")}`,
      );
    }

    parts.push("");
  }

  if (generated.setekExamples?.length) {
    parts.push(`## 세특 예시 (최상위)\n`);
    for (const ex of generated.setekExamples) {
      parts.push(`- ${ex.replace(/<[^>]*>/g, "").slice(0, 300)}`);
    }
    parts.push("");
  }

  return parts.join("\n");
}

// ============================================================
// Main
// ============================================================

export async function checkCoherence(
  generated: GeneratedGuideOutput,
): Promise<CoherenceCheckResult> {
  const userPrompt = buildUserPrompt(generated);

  const result = await generateObjectWithRateLimit({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    schema: zodSchema(coherenceResponseSchema),
    modelTier: "fast",
    temperature: 0.1,
    maxTokens: 4096,
    timeoutMs: 60_000,
  });

  const response: CoherenceResponse = result.object;

  const violations: Violation[] = response.violations.map((v) => ({
    rule: v.rule,
    severity: v.severity as ViolationSeverity,
    message: v.message,
    sectionKey: v.sectionKey,
  }));

  const errorCount = violations.filter((v) => v.severity === "error").length;
  const warningCount = violations.filter(
    (v) => v.severity === "warning",
  ).length;

  return {
    passed: errorCount === 0,
    violations,
    errorCount,
    warningCount,
    usage: result.usage,
  };
}
