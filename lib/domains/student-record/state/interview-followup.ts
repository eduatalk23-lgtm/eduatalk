// ============================================
// α5 면접 모듈 — rule_v1 순수 함수 (Sprint 2, 2026-04-20)
//
// 두 역할:
//   1) buildFollowupChainRuleV1 — depth 체인에서 다음 follow-up 질문 생성 (결정적 템플릿)
//   2) analyzeAnswerRuleV1 — 학생 답변 규칙 기반 분석 (consistency/authenticity/aiSignals/gap)
//
// LLM 비용 0. I/O 없음. Sprint 3 의 llm_v1 이 이 함수들을 대체·보강.
// ============================================

import type {
  InterviewAiSignals,
  InterviewAnswerAnalysis,
  InterviewChainDepth,
  InterviewChainNode,
  InterviewGapFinding,
  InterviewScenario,
} from "../types/interview";

// ─── 1. 꼬꼬무 템플릿 ─────────────────────────────────────────

/**
 * rule_v1 템플릿 5개. depth 1 (seed) 다음 질문부터 사용.
 * Sprint 3 LLM 이 이 중 문맥 부적합한 것을 대체.
 */
const FOLLOWUP_TEMPLATES: ReadonlyArray<{
  readonly slug: string;
  readonly question: string;
  readonly expectedHook: string;
}> = [
  {
    slug: "toughest",
    question: "그 활동에서 가장 어려웠던 순간은 무엇이었나요? 구체적으로 설명해 주세요.",
    expectedHook: "구체 경험·사례 + 본인이 직접 부딪힌 장애물",
  },
  {
    slug: "causal_reasoning",
    question: "결과가 왜 그렇게 나왔다고 생각하세요? 근거를 들어 말해 주세요.",
    expectedHook: "인과 논리 + 본인 분석 (단순 결과 설명 아님)",
  },
  {
    slug: "counterfactual",
    question: "다시 한다면 무엇을 바꾸겠어요? 그리고 왜 그렇게 판단하나요?",
    expectedHook: "성장 · 반성 · 판단 근거",
  },
  {
    slug: "career_link",
    question: "그 경험이 현재 진로 선택에 어떤 영향을 주었나요?",
    expectedHook: "진로 일관성 + 구체 연결 고리",
  },
  {
    slug: "next_step",
    question: "관련 후속 활동을 한다면 어떤 걸 하고 싶으세요?",
    expectedHook: "탐구 지속성 + 구체 계획",
  },
];

/**
 * 같은 템플릿이 반복되지 않도록, 지금까지 사용한 slug 를 피해 회전.
 */
function pickTemplate(
  usedSlugs: readonly string[],
): (typeof FOLLOWUP_TEMPLATES)[number] {
  const used = new Set(usedSlugs);
  for (const t of FOLLOWUP_TEMPLATES) if (!used.has(t.slug)) return t;
  // 전부 사용했으면 첫 번째 재사용
  return FOLLOWUP_TEMPLATES[0];
}

export interface BuildFollowupInput {
  /** 지금까지 세션에서 생성된 chain 들. depth 오름차순 권장. */
  readonly existingChains: readonly InterviewChainNode[];
  /** 마지막 chain (= 새 follow-up 의 부모). undefined 면 depth=1 root 생성 불가 에러. */
  readonly parentChain: InterviewChainNode | null;
  readonly scenario?: InterviewScenario;
}

export interface BuildFollowupResult {
  readonly questionText: string;
  readonly expectedHook: string;
  readonly depth: InterviewChainDepth;
  readonly slug: string;
  /** null 이면 더 이상 follow-up 불가 (depth 5 도달). */
  readonly terminal: boolean;
}

/**
 * depth 체인에서 다음 follow-up 질문을 결정적으로 생성.
 *
 * 호출자 계약:
 *   - parentChain=null → 호출 금지 (depth=1 root 는 student_record_interview_questions 시드 사용)
 *   - parentChain.depth === 5 → terminal=true + 템플릿 반환 안 함 (호출자가 세션 종료)
 */
export function buildFollowupChainRuleV1(
  input: BuildFollowupInput,
): BuildFollowupResult | null {
  const { existingChains, parentChain } = input;
  if (!parentChain) return null;
  if (parentChain.depth >= 5) {
    return {
      questionText: "",
      expectedHook: "",
      depth: 5,
      slug: "terminal",
      terminal: true,
    };
  }

  const nextDepth = (parentChain.depth + 1) as InterviewChainDepth;
  const usedSlugs = existingChains
    .map((c) => extractSlugFromHook(c.expectedHook))
    .filter((s): s is string => !!s);
  const tpl = pickTemplate(usedSlugs);

  return {
    questionText: tpl.question,
    expectedHook: withSlugTag(tpl.expectedHook, tpl.slug),
    depth: nextDepth,
    slug: tpl.slug,
    terminal: false,
  };
}

// expectedHook 에 slug 를 prefix 로 숨겨 저장 (LLM 이 자유 생성해도 호환되도록 tag-style).
const SLUG_PREFIX = "[rule_v1:";
function withSlugTag(hook: string, slug: string): string {
  return `${SLUG_PREFIX}${slug}] ${hook}`;
}
function extractSlugFromHook(hook: string | null): string | null {
  if (!hook) return null;
  if (!hook.startsWith(SLUG_PREFIX)) return null;
  const close = hook.indexOf("]");
  if (close <= 0) return null;
  return hook.slice(SLUG_PREFIX.length, close);
}

// ─── 2. 답변 분석 rule_v1 ────────────────────────────────────

export interface AnalyzeAnswerInput {
  readonly questionText: string;
  readonly expectedHook: string | null;
  readonly answerText: string;
  /**
   * 질문 생성 시점의 관련 생기부 근거 모음.
   * key = recordId, value = 본문 요약 (세특·창체·행특·독서 관계없이 plain text)
   */
  readonly evidenceRefs: ReadonlyArray<{
    readonly recordId: string;
    readonly summary: string;
  }>;
}

/** 규칙 기반 답변 분석. 실패 없음. I/O 없음. */
export function analyzeAnswerRuleV1(
  input: AnalyzeAnswerInput,
): Omit<InterviewAnswerAnalysis, "analyzedAt"> {
  const normAnswer = input.answerText.trim();
  if (normAnswer.length === 0) {
    return {
      consistencyScore: 0,
      authenticityScore: 0,
      aiSignals: emptySignals(),
      gapFindings: [
        {
          kind: "unsupported_claim",
          summary: "답변이 비어 있습니다.",
          sourceRecordIds: [],
        },
      ],
      coachComment: "답변을 작성해 주세요.",
      analyzedBy: "rule_v1",
      costUsd: 0,
    };
  }

  const aiSignals = computeAiSignals(normAnswer);
  const authenticityScore = authenticityFromSignals(aiSignals);
  const { consistencyScore, gapFindings } = computeConsistencyAndGaps(
    input.questionText,
    normAnswer,
    input.evidenceRefs,
  );
  const coachComment = buildCoachComment({
    consistencyScore,
    authenticityScore,
    gapFindings,
  });

  return {
    consistencyScore,
    authenticityScore,
    aiSignals,
    gapFindings,
    coachComment,
    analyzedBy: "rule_v1",
    costUsd: 0,
  };
}

// ─── 2-a. AI 신호 규칙 ────────────────────────────────────────

function emptySignals(): InterviewAiSignals {
  return { jargonDensity: 1, sentenceUniformity: 1, vagueHedging: 1 };
}

const HEDGING_KEYWORDS = [
  "다양한",
  "여러",
  "매우",
  "상당히",
  "많은",
  "폭넓은",
  "다채로운",
  "깊이 있는",
  "깊이있는",
  "심도 있는",
  "심도있는",
];

function computeAiSignals(answer: string): InterviewAiSignals {
  // 1) jargonDensity: 한자어/외래어 비율 간접 지표 — 음절 당 한글 초성 aeiou 대응은 어려움
  //    대체로 "의"·"이"·"가"·"은"·"는" 같은 기능어 비율이 낮으면 문장이 무겁다고 간주
  const totalLen = Math.max(1, answer.length);
  const functionWordMatches = answer.match(/(이|가|은|는|을|를|에|의|와|과)\s/g);
  const functionWordCount = functionWordMatches ? functionWordMatches.length : 0;
  const fnRatio = functionWordCount / (totalLen / 8);
  const jargonDensity = clamp1to5(5 - Math.round(fnRatio * 3));

  // 2) sentenceUniformity: 문장 길이 표준편차 낮음 = 획일적
  const sentences = answer
    .split(/(?<=[.!?]|다\.|요\.|음\.|죠\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const lengths = sentences.length > 0 ? sentences.map((s) => s.length) : [answer.length];
  const mean = lengths.reduce((s, n) => s + n, 0) / lengths.length;
  const variance =
    lengths.reduce((s, n) => s + (n - mean) ** 2, 0) / lengths.length;
  const stdev = Math.sqrt(variance);
  // stdev/mean (coefficient of variation) 이 낮을수록 획일적 → 점수 높음
  const cv = mean > 0 ? stdev / mean : 0;
  const sentenceUniformity = clamp1to5(5 - Math.round(cv * 8));

  // 3) vagueHedging: 헤징 키워드 빈도 (답변 길이 보정)
  const hedgingCount = HEDGING_KEYWORDS.reduce(
    (sum, kw) =>
      sum + (answer.match(new RegExp(kw, "g")) || []).length,
    0,
  );
  const hedgingPer100 = (hedgingCount / totalLen) * 100;
  const vagueHedging = clamp1to5(1 + Math.round(hedgingPer100 * 2));

  return { jargonDensity, sentenceUniformity, vagueHedging };
}

function clamp1to5(n: number): number {
  return Math.max(1, Math.min(5, n));
}

function authenticityFromSignals(s: InterviewAiSignals): number {
  // 각 신호는 1~5, 높을수록 AI 의심. 역전 후 합산 → 0~100 스케일.
  const invJargon = 6 - s.jargonDensity;
  const invUniform = 6 - s.sentenceUniformity;
  const invHedging = 6 - s.vagueHedging;
  const raw = invJargon + invUniform + invHedging; // 3~15
  const score = Math.round(((raw - 3) / 12) * 100);
  return Math.max(0, Math.min(100, score));
}

// ─── 2-b. 일관성·gap 규칙 ─────────────────────────────────────

const STOPWORDS = new Set([
  "그", "이", "저", "그것", "이것", "저것",
  "있다", "없다", "하다", "되다", "같다",
  "등", "및", "또는", "그리고", "하지만", "그러나",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?"()[\]{}·…:;~]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function computeConsistencyAndGaps(
  questionText: string,
  answerText: string,
  evidence: ReadonlyArray<{ recordId: string; summary: string }>,
): { consistencyScore: number; gapFindings: readonly InterviewGapFinding[] } {
  // 한국어 조사 처리: 답변 raw 문자열 substring 매칭 + token set 보조.
  const answerTokens = new Set(tokenize(answerText));
  const answerLower = answerText.toLowerCase();
  const gapFindings: InterviewGapFinding[] = [];

  // 증거 없는 경우: 질문 자체에서만 근거 찾을 수 없으므로 중립 점수 + missing_evidence
  if (evidence.length === 0) {
    gapFindings.push({
      kind: "missing_evidence",
      summary: "질문 시점의 생기부 근거가 제공되지 않았습니다. 분석 정확도 제한.",
      sourceRecordIds: [],
    });
    return { consistencyScore: 50, gapFindings };
  }

  // 답변에서 숫자·연도·단위 추출 — 증거에 없으면 unsupported_claim.
  // 주의: 한국어 단위 뒤에 \b 붙이면 ASCII word-boundary 규칙상 매치 실패. 단어 경계 lookahead 로 대체.
  const numericClaims = Array.from(
    answerText.matchAll(/\b(?:19|20)\d{2}(?!\d)|\b\d+(?:\.\d+)?(?:명|회|시간|점|%|권)/g),
  ).map((m) => m[0]);
  const evidenceText = evidence.map((e) => e.summary).join(" ").toLowerCase();
  const unsupportedNumerics = numericClaims.filter(
    (c) => !evidenceText.includes(c.toLowerCase()),
  );
  if (unsupportedNumerics.length > 0) {
    gapFindings.push({
      kind: "unsupported_claim",
      summary: `답변의 수치 주장이 생기부 근거로 확인되지 않음: ${unsupportedNumerics.slice(0, 3).join(", ")}`,
      sourceRecordIds: evidence.map((e) => e.recordId),
    });
  }

  // consistency: 증거 토큰 ∩ 답변 토큰 / 증거 토큰 고유 수 × 100
  const evidenceTokens = new Set<string>();
  for (const e of evidence) {
    for (const t of tokenize(e.summary)) evidenceTokens.add(t);
  }
  if (evidenceTokens.size === 0) {
    return { consistencyScore: 50, gapFindings };
  }
  let hit = 0;
  for (const t of evidenceTokens) {
    // 1) 정확 매칭 또는 2) 답변 raw 문자열에 substring 포함 (조사 대응)
    if (answerTokens.has(t) || answerLower.includes(t)) hit++;
  }
  const score = Math.round((hit / evidenceTokens.size) * 100);
  const consistencyScore = Math.max(0, Math.min(100, score));

  // consistencyScore 낮으면 추가 gap 경고
  if (consistencyScore < 25) {
    gapFindings.push({
      kind: "missing_evidence",
      summary: "답변이 제공된 생기부 근거와 겹치는 키워드가 거의 없습니다.",
      sourceRecordIds: evidence.map((e) => e.recordId),
    });
  }

  return { consistencyScore, gapFindings };
}

// ─── 2-c. Coach comment 템플릿 ────────────────────────────────

function buildCoachComment(input: {
  readonly consistencyScore: number;
  readonly authenticityScore: number;
  readonly gapFindings: readonly InterviewGapFinding[];
}): string {
  const parts: string[] = [];
  if (input.consistencyScore < 40)
    parts.push("답변이 생기부 근거와 연결이 약합니다 — 구체 기록을 인용해 보세요.");
  else if (input.consistencyScore >= 70)
    parts.push("생기부 근거와의 정렬이 좋습니다.");

  if (input.authenticityScore < 40)
    parts.push("문장이 일반적·추상적입니다 — 본인 경험의 구체 장면을 덧붙여 주세요.");
  else if (input.authenticityScore >= 70)
    parts.push("본인 언어가 잘 드러납니다.");

  if (input.gapFindings.length > 0 && input.consistencyScore < 60)
    parts.push(`지적 사항 ${input.gapFindings.length}건을 확인하세요.`);

  if (parts.length === 0) parts.push("전반적으로 무난한 답변입니다.");
  return parts.join(" ");
}

// ─── 3. Score summary 집계 ────────────────────────────────────

export interface InterviewSessionAggregateInput {
  readonly answers: ReadonlyArray<
    Pick<
      InterviewAnswerAnalysis,
      "consistencyScore" | "authenticityScore" | "aiSignals" | "gapFindings"
    >
  >;
}

/** 답변 배열 → score_summary 직렬화용 JSON. */
export function aggregateSessionScore(input: InterviewSessionAggregateInput): {
  avgConsistency: number | null;
  avgAuthenticity: number | null;
  gapCount: number;
  aiSuspicionLevel: "low" | "medium" | "high";
} {
  const xs = input.answers;
  if (xs.length === 0) {
    return {
      avgConsistency: null,
      avgAuthenticity: null,
      gapCount: 0,
      aiSuspicionLevel: "low",
    };
  }
  const avg = (arr: readonly number[]) =>
    Math.round(arr.reduce((s, n) => s + n, 0) / arr.length);
  const avgConsistency = avg(xs.map((a) => a.consistencyScore));
  const avgAuthenticity = avg(xs.map((a) => a.authenticityScore));
  const gapCount = xs.reduce((s, a) => s + a.gapFindings.length, 0);

  const aiSum = xs.reduce((s, a) => {
    const sig = a.aiSignals;
    return s + sig.jargonDensity + sig.sentenceUniformity + sig.vagueHedging;
  }, 0);
  const aiAvg = aiSum / (xs.length * 3); // 1~5
  const aiSuspicionLevel: "low" | "medium" | "high" =
    aiAvg >= 4 ? "high" : aiAvg >= 2.8 ? "medium" : "low";

  return { avgConsistency, avgAuthenticity, gapCount, aiSuspicionLevel };
}
