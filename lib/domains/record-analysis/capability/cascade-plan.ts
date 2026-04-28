// ============================================
// capability/cascade-plan.ts
//
// M1-c (2026-04-27): 메인테마 → 1·2·3학년 cascade 배분 plan capability.
//
// 입력: 메인테마 + 대상 학년 목록 + (있는 만큼의) NEIS 발췌 + (있다면) blueprint targetConvergences.
// 출력: { byGrade: { [grade]: { tier, subjects, contentSummary, evidenceFromNeis?, rationale } }, ... }
//
// 핵심 원칙:
//  - 학년 무관 단일 cascade — NEIS 있는 학년은 evidence 결속, 없는 학년은 design 대상.
//  - tier 자동 분배 — 1학년=foundational, 2학년=development, 3학년=advanced 가 기본.
//    단, 학생 학년/현재 위치에 따라 prompt 가 조정 가능 (예: 2학년 신규 학생도 1학년 평가는 회고).
//  - 학년별 rationale 필수 — "왜 이 학년에 이 교과/난이도인가" LLM 출력에 포함.
//  - blueprint targetConvergences 가 있으면 cascade 와 정합성 검사 (동일 진로 척추인지).
// ============================================

import "server-only";

import { z } from "zod";
import { generateTextWithRateLimit, type ModelTier } from "../llm/ai-client";
import { withRetry } from "../llm/retry";
import { extractJson } from "../llm/extractJson";
import type { MainTheme } from "./main-theme";

// ============================================
// 타입
// ============================================

// M1-c W6 hotfix (2026-04-28): 모든 string max 충분히 관대하게.
// LLM 응답 가변성 (학년/학생/모델 변동) 흡수 위해. 인제고 2학년 풀런에서 cascadePlan
// silent zod fail (cascade_plan=null 영속). max 제한 너무 빡빡하면 어떤 field 든 borderline
// 도달 시 전체 cascade 영속 실패 → 본질 미달성. 충분히 큰 max 로 LLM 응답 다양성 수용.
const cascadeGradeNodeSchema = z.object({
  tier: z.enum(["foundational", "development", "advanced"]),
  subjects: z
    .array(z.string().min(1).max(80))
    .min(1)
    .max(10)
    .describe("이 학년에서 메인테마를 다룰 핵심 교과"),
  contentSummary: z
    .string()
    .min(10)
    .max(800)
    .describe("이 학년에서 무엇을 어떻게 탐구할지 요약 (2~3문장)"),
  evidenceFromNeis: z
    .array(z.string().min(2).max(300))
    .max(12)
    .optional()
    .describe("NEIS 활동 기반 인용 — 이미 충족된 부분 (있는 학년만)"),
  rationale: z
    .string()
    .min(10)
    .max(800)
    .describe("왜 이 학년에 이 tier·교과인가의 근거"),
});

export const cascadePlanSchema = z.object({
  themeLabel: z.string().min(2).max(160),
  byGrade: z.record(z.string(), cascadeGradeNodeSchema),
  // 일관성 노트 (선택) — blueprint 와의 정합성 등
  coherenceNote: z.string().max(800).optional(),
});

export type CascadeGradeNode = z.infer<typeof cascadeGradeNodeSchema>;
export type CascadePlan = z.infer<typeof cascadePlanSchema>;

export interface BuildCascadePlanInput {
  /** 메인테마 — deriveMainTheme 산출물 */
  mainTheme: MainTheme;
  /** 대상 학년 (보통 [1,2,3]). 학생이 2학년이면 1·2·3 모두 포함, 회고+설계 혼합. */
  targetGrades: number[];
  /** 학생 현재 학년 (rationale 작성 시 회고/설계 구분에 사용) */
  currentGrade?: number | null;
  /** NEIS 있는 학년만 — evidenceFromNeis 결속용 */
  neisExtractsByGrade?: Record<number, Array<{ category: string; summary: string }>>;
  /** 수강계획 (있는 만큼) */
  coursePlanByGrade?: Record<number, string[]>;
  /** Blueprint targetConvergences (있다면 정합성 힌트) */
  blueprintConvergences?: Array<{
    grade: number;
    themeLabel: string;
    themeKeywords: string[];
    tierAlignment: "foundational" | "development" | "advanced";
  }>;
}

export interface BuildCascadePlanOptions {
  tier?: ModelTier;
}

export interface BuildCascadePlanSuccess {
  ok: true;
  plan: CascadePlan;
  modelId?: string;
  usage?: { inputTokens: number; outputTokens: number };
  elapsedMs: number;
}

export interface BuildCascadePlanFailure {
  ok: false;
  reason: string;
}

export type BuildCascadePlanResult =
  | BuildCascadePlanSuccess
  | BuildCascadePlanFailure;

// ============================================
// 프롬프트
// ============================================

const SYSTEM_PROMPT = `당신은 한국 고등학생 학종 컨설턴트입니다. 학생의 메인 탐구주제를 받아
**1·2·3학년에 어떻게 cascade(기초→발전→심화)로 배분할지** 학년별 plan 1세트를 도출합니다.

핵심 원칙:
1. **학년 무관 일관 척추** — 단일 메인테마가 1/2/3학년 모두에 일관되게 흐르되, tier 단계가 증가.
2. **tier 기본 매핑** — 1학년=foundational(개념/기초), 2학년=development(실험/발전), 3학년=advanced(심화/통합).
   학생 현재 학년이 2학년이면 1학년은 회고, 2·3학년은 설계.
3. **evidenceFromNeis 강한 가드 (중요)** — 입력의 "## NEIS 발췌 (학년별)" 섹션에 해당 학년 발췌가
   존재하는 학년에만 evidenceFromNeis 채울 것. 발췌가 없으면 **반드시 빈 배열 [] 또는 필드 생략**.
   추정·권고·일반 활동(예: "기초 실험 수행", "개념 학습")을 evidenceFromNeis 에 넣지 말 것 —
   이는 가짜 evidence 로 간주되어 후처리에서 제거됨. 발췌 인용은 입력 텍스트에서 직접 발췌해야 함.
4. **NEIS 없는 학년은 design** — evidenceFromNeis 비움, contentSummary 에 "앞으로 무엇을 어떻게" 명시.
5. **학년별 rationale 필수** — "왜 이 학년에 이 교과·난이도인가" 진로/계열/이전 활동 인용.
6. **subjects 는 한국 고등학교 표준 교과명만** — 다음 중에서만 선택:
   · 일반선택/공통: 통합과학, 통합사회, 한국사, 국어, 영어, 수학, 사회, 과학, 체육, 예술
   · 진로선택 과학: 물리학, 화학, 생명과학, 지구과학(또는 I/II)
   · 진로선택 수학: 대수, 미적분I, 미적분II, 확률과통계, 기하, 미적분, 수학I, 수학II
   · 진로선택 사회: 윤리와사상, 정치와법, 경제, 한국지리, 세계지리, 사회문화, 생활과윤리
   · 융합/특수: 과학탐구실험, 수학과제탐구, 화학반응의세계, 세포와물질대사, 과학의역사와문화
   "의학", "약학", "건강 정책", "의학 윤리", "프로그래밍" 등은 고교 교과 아님 → **사용 금지**.
   대신 "생명과학", "생활과윤리", "사회문화" 등 가장 가까운 표준 교과명으로 변환.
   학생 수강계획이 입력에 있으면 그 안에서만 선택.
7. **contentSummary 는 구체적** — "다양한 주제를 탐구" 같은 추상 표현 금지.
   학생 진로 + 메인테마 키워드를 활용해 "어떤 개념을, 어떤 단원에서, 어떤 산출물(보고서/실험/독서)" 형태로.

반드시 다음 JSON 1개만 출력하세요 (byGrade 키는 학년 숫자 문자열):
{
  "themeLabel": "메인테마 라벨 그대로 복사",
  "byGrade": {
    "1": {
      "tier": "foundational",
      "subjects": ["통합과학", "수학"],
      "contentSummary": "1학년에 무엇을 어떻게",
      "evidenceFromNeis": [],
      "rationale": "왜 1학년에 이 tier·교과인가"
    },
    "2": { ... },
    "3": { ... }
  },
  "coherenceNote": "blueprint targetConvergences 와의 정합성 메모 (있다면)"
}`;

function buildUserPrompt(input: BuildCascadePlanInput): string {
  const lines: string[] = [
    "## 메인 탐구주제",
    `- label: ${input.mainTheme.label}`,
    `- keywords: ${input.mainTheme.keywords.join(", ")}`,
    `- rationale: ${input.mainTheme.rationale}`,
    "",
    `## 대상 학년: ${input.targetGrades.join(", ")} (현재 학년: ${input.currentGrade ?? "미상"})`,
  ];

  if (input.coursePlanByGrade && Object.keys(input.coursePlanByGrade).length > 0) {
    lines.push("", "## 수강계획");
    for (const grade of input.targetGrades) {
      const subjects = input.coursePlanByGrade[grade];
      if (subjects && subjects.length > 0) {
        lines.push(`- ${grade}학년: ${subjects.join(", ")}`);
      }
    }
  }

  if (input.neisExtractsByGrade && Object.keys(input.neisExtractsByGrade).length > 0) {
    lines.push("", "## NEIS 발췌 (학년별)");
    for (const grade of input.targetGrades) {
      const extracts = input.neisExtractsByGrade[grade];
      if (extracts && extracts.length > 0) {
        lines.push(`### ${grade}학년`);
        for (const ex of extracts.slice(0, 12)) {
          lines.push(`- [${ex.category}] ${ex.summary}`);
        }
      }
    }
  }

  if (input.blueprintConvergences && input.blueprintConvergences.length > 0) {
    lines.push("", "## Blueprint targetConvergences (정합성 참고)");
    for (const c of input.blueprintConvergences) {
      lines.push(
        `- ${c.grade}학년/${c.tierAlignment}: ${c.themeLabel} (${c.themeKeywords.join(", ")})`,
      );
    }
  }

  lines.push("", "위 정보로 학년별 cascade plan JSON 1개만 출력하세요.");
  return lines.join("\n");
}

// ============================================
// capability 진입점
// ============================================

export async function buildCascadePlan(
  input: BuildCascadePlanInput,
  options?: BuildCascadePlanOptions,
): Promise<BuildCascadePlanResult> {
  const startedAt = Date.now();
  const tier: ModelTier = options?.tier ?? "fast";

  if (input.targetGrades.length === 0) {
    return { ok: false, reason: "targetGrades 가 비어있음" };
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
          responseFormat: "json",
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
    const parsed = cascadePlanSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        reason: `스키마 검증 실패: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    // 추가 검증: byGrade 의 키가 targetGrades 와 정합한지
    const grades = Object.keys(parsed.data.byGrade)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n));
    const missing = input.targetGrades.filter((g) => !grades.includes(g));
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `byGrade 누락 학년: ${missing.join(", ")}`,
      };
    }

    return {
      ok: true,
      plan: parsed.data,
      modelId: result.modelId,
      usage: result.usage,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "cascade plan 생성 실패",
    };
  }
}
