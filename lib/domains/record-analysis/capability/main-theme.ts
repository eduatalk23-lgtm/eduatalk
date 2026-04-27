// ============================================
// capability/main-theme.ts
//
// M1-c (2026-04-27): 메인 탐구주제 capability.
//
// 입력: 진로(target_major / classificationId / careerFieldHint) +
//       (있는 만큼의) NEIS 추출 요약 + 수강계획.
// 출력: { label, rationale, sourceCitations[], keywords[] }
//
// 핵심 원칙:
//  - NEIS 유무는 "근거 강도" 차이일 뿐. 학년 무관하게 단일 메인테마 1개 도출.
//  - 1학년 신규(NEIS 0건)에도 진로만으로 도출 가능 — cold start 의 핵심 척추.
//  - sourceCitations 는 NEIS 인용 또는 "career:전공" / "classification:KEDI소분류" 같은 구조화 인용.
// ============================================

import "server-only";

import { z } from "zod";
import { generateTextWithRateLimit, type ModelTier } from "../llm/ai-client";
import { withRetry } from "../llm/retry";
import { extractJson } from "../llm/extractJson";

// ============================================
// 타입
// ============================================

export const mainThemeSchema = z.object({
  label: z.string().min(2).max(80).describe("메인 탐구주제 한 줄 라벨"),
  rationale: z.string().min(20).max(400).describe("이 주제를 메인으로 정한 이유 (3~5문장)"),
  sourceCitations: z
    .array(z.string().min(2).max(120))
    .min(1)
    .max(8)
    .describe("근거 인용. NEIS 발췌 또는 'career:전공명' / 'classification:KEDI' 형식"),
  keywords: z
    .array(z.string().min(2).max(20))
    .min(2)
    .max(8)
    .describe("주제 핵심 키워드 (cascadePlan 에서 학년별 재사용)"),
});

export type MainTheme = z.infer<typeof mainThemeSchema>;

export interface DeriveMainThemeInput {
  /** 진로 — 전공명 / 계열명 / KEDI 분류 */
  studentProfile: {
    targetMajor?: string | null;
    careerFieldHint?: string | null;
    classificationLabel?: string | null;
  };
  /**
   * NEIS 발췌 요약. 있는 만큼만 — 신규 1학년은 빈 배열.
   * 각 발췌는 학년 + 카테고리(setek/changche/haengteuk/award/volunteer) + 짧은 요약.
   */
  neisExtracts?: Array<{
    grade: number;
    category: string;
    summary: string;
  }>;
  /** 수강계획 학년별 핵심 과목 라벨 (있는 만큼) */
  coursePlan?: Array<{ grade: number; subjects: string[] }>;
  /** 이전 실행에서 도출한 메인테마 (있다면) — 일관성 힌트 */
  previousTheme?: MainTheme | null;
}

export interface DeriveMainThemeOptions {
  /** 모델 tier. 기본 fast (Pro fallback). */
  tier?: ModelTier;
}

export interface DeriveMainThemeSuccess {
  ok: true;
  theme: MainTheme;
  modelId?: string;
  usage?: { inputTokens: number; outputTokens: number };
  elapsedMs: number;
}

export interface DeriveMainThemeFailure {
  ok: false;
  reason: string;
}

export type DeriveMainThemeResult = DeriveMainThemeSuccess | DeriveMainThemeFailure;

// ============================================
// 프롬프트
// ============================================

const SYSTEM_PROMPT = `당신은 한국 고등학생 학종 컨설턴트입니다. 학생의 진로와 (있다면) 학생부 활동을 보고
학생을 관통하는 **메인 탐구주제 1개**를 도출합니다.

핵심 원칙:
1. **학년 무관 단일 주제** — 1학년 신규든 3학년이든 동일한 깊이로 1개만.
2. **진로 + 활동의 교집합** — 진로 키워드를 단순 변환하지 말고 활동에서 드러난 결을 통합.
   (반례: target_major=의학·약학 → "의학·약학 융합 탐구" 같은 진로 그대로 복붙은 금지)
3. **label 은 구체적**: 진로 카테고리 + **세부 영역 또는 관점** 결합.
   예 시(의예과·NEIS 0건): "정밀의료의 임상-약물 인터페이스" / "공중보건과 의약품 접근성" / "유전체 데이터 기반 질병 예측".
   "OO 융합 탐구" / "OO에 대한 탐구" 같은 일반화 라벨은 금지.
4. **NEIS 가 없으면 진로만으로** — 활동 발췌가 빈 경우, 진로 + 계열 분류만으로도 위 3번 수준의 구체성을 유지.
5. **rationale 은 학생 결의 통합**: "왜 이 주제인가" 를 진로 동기·활동 키워드·계열 특성으로 연결 (3~5문장).
   "다양한 주제를 탐구하는 것이 중요하다" 류 일반론 금지.
6. **근거 인용 필수** — sourceCitations 에 NEIS 발췌 인용 또는 "career:전공명" 형태로 명시.
7. **키워드 2~6개** — cascadePlan 단계에서 학년별 재사용될 **핵심 명사구** (예: "정밀의료", "유전체", "의료윤리").
   너무 광범위한 단어("탐구", "융합", "건강") 단독 사용은 금지.

반드시 다음 JSON 1개만 출력하세요:
{
  "label": "메인 탐구주제 한 줄",
  "rationale": "왜 이 주제인가 3~5문장",
  "sourceCitations": ["근거1", "근거2", ...],
  "keywords": ["키워드1", "키워드2", ...]
}`;

function buildUserPrompt(input: DeriveMainThemeInput): string {
  const lines: string[] = ["## 학생 진로"];
  const sp = input.studentProfile;
  if (sp.targetMajor) lines.push(`- 목표 전공: ${sp.targetMajor}`);
  if (sp.careerFieldHint) lines.push(`- 진로 계열: ${sp.careerFieldHint}`);
  if (sp.classificationLabel) lines.push(`- 분류: ${sp.classificationLabel}`);
  if (lines.length === 1) lines.push("- (정보 없음 — 진로 입력을 기다리는 단계)");

  if (input.coursePlan && input.coursePlan.length > 0) {
    lines.push("", "## 수강 계획");
    for (const cp of input.coursePlan) {
      lines.push(`- ${cp.grade}학년: ${cp.subjects.join(", ")}`);
    }
  }

  if (input.neisExtracts && input.neisExtracts.length > 0) {
    lines.push("", "## NEIS 활동 발췌");
    for (const ex of input.neisExtracts.slice(0, 30)) {
      lines.push(`- [${ex.grade}학년/${ex.category}] ${ex.summary}`);
    }
  } else {
    lines.push("", "## NEIS 활동", "- (없음 — 신규 학생 cold start)");
  }

  if (input.previousTheme) {
    lines.push(
      "",
      "## 이전 메인테마 (참고)",
      `- label: ${input.previousTheme.label}`,
      `- keywords: ${input.previousTheme.keywords.join(", ")}`,
      "이전 결과와 일관성을 유지하되, 신규 정보가 있으면 갱신하세요.",
    );
  }

  lines.push("", "위 정보를 종합해 메인 탐구주제 JSON 1개만 출력하세요.");
  return lines.join("\n");
}

// ============================================
// capability 진입점
// ============================================

export async function deriveMainTheme(
  input: DeriveMainThemeInput,
  options?: DeriveMainThemeOptions,
): Promise<DeriveMainThemeResult> {
  const startedAt = Date.now();
  const tier: ModelTier = options?.tier ?? "fast";

  // 가드: 진로 정보가 전무하면 capability 호출 부적절.
  const sp = input.studentProfile;
  if (!sp.targetMajor && !sp.careerFieldHint && !sp.classificationLabel) {
    return {
      ok: false,
      reason: "진로 정보(targetMajor / careerFieldHint / classificationLabel) 가 모두 없음",
    };
  }

  const userPrompt = buildUserPrompt(input);
  try {
    const result = await withRetry(
      () =>
        generateTextWithRateLimit({
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          modelTier: tier,
          temperature: 0.4,
        }),
      { maxRetries: 2 },
    );

    let json: unknown;
    try {
      json = extractJson(result.content);
    } catch (err) {
      return {
        ok: false,
        reason: `JSON 추출 실패: ${err instanceof Error ? err.message : "unknown"}`,
      };
    }
    const parsed = mainThemeSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        reason: `스키마 검증 실패: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      };
    }
    return {
      ok: true,
      theme: parsed.data,
      modelId: result.modelId,
      usage: result.usage,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "메인테마 도출 실패",
    };
  }
}
