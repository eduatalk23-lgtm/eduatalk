// ============================================
// α5 Interview 모듈 — llm_v1 답변 분석 프롬프트 (Sprint 3, 2026-04-20)
//
// 입력: 질문·expectedHook·학생 답변·관련 생기부 근거·asOf
// 출력: consistency/authenticity/aiSignals/gapFindings/coachComment JSON
//   → rule_v1 의 InterviewAnswerAnalysis 스키마와 동일 (analyzedBy='llm_v1')
//
// 설계:
//   - consistency 는 근거 정합성(생기부 문맥과 맞는가)
//   - authenticity 는 본인 언어 강도 (AI 복붙 감지 반영)
//   - aiSignals 는 1~5 척도 (rule_v1 과 동일)
//   - gapFindings 4종: unsupported_claim / missing_evidence / contradiction / ess_violation
// ============================================

import { extractJson } from "../extractJson";
import type {
  InterviewAiSignals,
  InterviewAnswerAnalysis,
  InterviewGapFinding,
  InterviewGapKind,
} from "@/lib/domains/student-record/types/interview";

export interface AnswerAnalysisPromptInput {
  readonly questionText: string;
  readonly expectedHook: string | null;
  readonly answerText: string;
  readonly evidenceRefs: ReadonlyArray<{
    readonly recordId: string;
    readonly summary: string;
  }>;
  /** StudentState.asOf.label — ESS 위반 판정용. */
  readonly asOfLabel: string | null;
}

export type AnswerAnalysisLlmResult = Omit<
  InterviewAnswerAnalysis,
  "analyzedAt" | "costUsd"
>;

export const INTERVIEW_ANSWER_ANALYSIS_SYSTEM_PROMPT = `당신은 대한민국 대입 학종 면접 대비 코치이자 학생 답변 분석가입니다. 학생의 면접 답변을 면접관 시각으로 분석해 JSON 을 반환합니다.

## 평가 차원

1. **consistencyScore (0~100)** — 답변 주장이 **생기부 근거(evidence)** 로 뒷받침되는가.
   - 100: 답변 전체가 evidence 키워드·사실로 뒷받침, 인용 적절
   - 70~90: 대부분 정렬, 일부 보완 필요
   - 40~60: 일부만 정렬, 여러 주장이 evidence 에 없음
   - 0~30: 대부분 evidence 와 무관, 일반론·타인 경험
2. **authenticityScore (0~100)** — 본인 언어 강도. 높을수록 학생 자연어, 낮을수록 AI 복붙 의심.
   - 100: 구체적 체험·시행착오·사소한 디테일, 본인만의 표현
   - 70~90: 구체적이나 다소 매끄럽게 다듬어짐
   - 40~60: 일반적 학생 답변 수준, 템플릿 느낌 섞임
   - 0~30: GPT 냄새 강함 — 매끄러운 구조 + 추상적 단어 + 구체 경험 0
3. **aiSignals** (각 1~5, 5 = AI 강한 의심):
   - jargonDensity: 전문용어·한자어 과밀도
   - sentenceUniformity: 문장 구조 획일성 (GPT 특유 패턴)
   - vagueHedging: "다양한/여러/매우/상당히" 등 공허한 수식어 빈도
4. **gapFindings[]** — 최대 5건. 각 finding:
   - kind:
     · **unsupported_claim** — 답변에 있는 주장이 evidence 에 없음 (숫자·연도·사례·고유명사 포함)
     · **missing_evidence** — evidence 에 있는데 답변이 언급 못 함 (답변이 얕거나 핵심 누락)
     · **contradiction** — 답변과 evidence 가 직접 충돌
     · **ess_violation** — 답변이 asOf 시점 이후의 미래 정보를 이미 일어난 것처럼 기술
   - summary: 1~2 문장, 구체 인용
   - sourceRecordIds: 관련 evidence 의 recordId 배열 (없으면 빈 배열)
5. **coachComment** — 1~2 문장 면접 코치 톤. 답변 개선 방향 제시.

## 절대 규칙
- 점수는 엄격하게. 평범한 답변에 70점 이상 주지 말 것.
- evidence 가 비어있으면 consistency 는 50 기본, gapFindings 에 missing_evidence 1건 포함.
- 답변이 비어있거나 20자 미만이면 전 점수 20 이하 + 부적절 지적.
- 학생 비난·모욕 금지. 개선 지점만.
- 출력은 JSON only, no prose.

## JSON 스키마
\`\`\`json
{
  "consistencyScore": 0,
  "authenticityScore": 0,
  "aiSignals": { "jargonDensity": 1, "sentenceUniformity": 1, "vagueHedging": 1 },
  "gapFindings": [
    { "kind": "unsupported_claim" | "missing_evidence" | "contradiction" | "ess_violation", "summary": "...", "sourceRecordIds": ["..."] }
  ],
  "coachComment": "..."
}
\`\`\``;

function formatEvidence(
  refs: AnswerAnalysisPromptInput["evidenceRefs"],
): string {
  if (refs.length === 0) return "  (생기부 근거 미제공)";
  return refs
    .slice(0, 6)
    .map((e, i) => `  [${i + 1}] (${e.recordId}) ${truncate(e.summary, 280)}`)
    .join("\n");
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

export function buildAnswerAnalysisUserPrompt(
  input: AnswerAnalysisPromptInput,
): string {
  const lines: string[] = [];

  lines.push("## 질문");
  lines.push(`  ${input.questionText.trim()}`);
  if (input.expectedHook) {
    lines.push(`  [expectedHook] ${input.expectedHook.trim()}`);
  }

  lines.push("");
  lines.push("## 학생 답변");
  lines.push(input.answerText.trim() || "  (빈 답변)");

  lines.push("");
  lines.push("## 관련 생기부 근거");
  lines.push(formatEvidence(input.evidenceRefs));

  if (input.asOfLabel) {
    lines.push("");
    lines.push(`## asOf 시점: ${input.asOfLabel} — 이 시점 이후 정보를 과거시제로 말하면 ess_violation`);
  }

  lines.push("");
  lines.push("## 작업");
  lines.push("위 답변을 분석해 JSON (consistencyScore/authenticityScore/aiSignals/gapFindings/coachComment) 를 반환하세요.");

  return lines.join("\n");
}

const VALID_KINDS: InterviewGapKind[] = [
  "unsupported_claim",
  "missing_evidence",
  "contradiction",
  "ess_violation",
];

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function parseAnswerAnalysisResponse(
  raw: string,
): AnswerAnalysisLlmResult {
  const parsed = extractJson<Record<string, unknown>>(raw);

  const consistencyScore = clamp(parsed.consistencyScore, 0, 100, 0);
  const authenticityScore = clamp(parsed.authenticityScore, 0, 100, 0);

  const rawSignals = (parsed.aiSignals ?? {}) as Record<string, unknown>;
  const aiSignals: InterviewAiSignals = {
    jargonDensity: clamp(rawSignals.jargonDensity, 1, 5, 1),
    sentenceUniformity: clamp(rawSignals.sentenceUniformity, 1, 5, 1),
    vagueHedging: clamp(rawSignals.vagueHedging, 1, 5, 1),
  };

  const rawFindings = Array.isArray(parsed.gapFindings)
    ? parsed.gapFindings
    : [];
  const gapFindings: InterviewGapFinding[] = rawFindings
    .flatMap((f: unknown): InterviewGapFinding[] => {
      if (!f || typeof f !== "object") return [];
      const o = f as Record<string, unknown>;
      const kind = o.kind as InterviewGapKind;
      if (!VALID_KINDS.includes(kind)) return [];
      const summary = typeof o.summary === "string" ? o.summary.trim() : "";
      if (!summary) return [];
      const sourceRecordIds = Array.isArray(o.sourceRecordIds)
        ? o.sourceRecordIds.map(String)
        : [];
      return [{ kind, summary, sourceRecordIds }];
    })
    .slice(0, 6);

  const coachComment =
    typeof parsed.coachComment === "string" && parsed.coachComment.trim()
      ? parsed.coachComment.trim()
      : "분석 코멘트가 생성되지 않았습니다.";

  return {
    consistencyScore,
    authenticityScore,
    aiSignals,
    gapFindings,
    coachComment,
    analyzedBy: "llm_v1",
  };
}
