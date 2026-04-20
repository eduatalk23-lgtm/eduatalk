// ============================================
// α5 Interview 모듈 — llm_v1 꼬꼬무 (follow-up) 프롬프트 (Sprint 3, 2026-04-20)
//
// 입력: seed 질문 + 지금까지 depth 체인(Q/A) + 다음 depth + 관련 생기부 근거
// 출력: follow-up 질문 1개 + expectedHook (JSON)
//
// 설계:
//   - 학종 8단계 프레임 + 약점 공격 각도 재사용 (interviewQuestions.ts 의 축약판)
//   - 단순 반복 금지, 이전 답변의 논리 약점·미증명 주장을 집중 공략
//   - rule_v1 템플릿과 중복 회피
// ============================================

import { extractJson } from "../extractJson";

export interface FollowupPromptChainEntry {
  readonly depth: number;
  readonly question: string;
  readonly answer: string | null;
}

export interface FollowupPromptInput {
  readonly rootQuestion: string;
  readonly chain: readonly FollowupPromptChainEntry[];
  readonly nextDepth: 2 | 3 | 4 | 5;
  readonly scenario: {
    readonly targetMajor: string | null;
    readonly targetUniversityLevel: string | null;
    readonly focus: string | null;
  };
  /** 관련 생기부 원본 요약(최대 5건 권장). 비어있어도 허용. */
  readonly evidenceRefs: ReadonlyArray<{
    readonly recordId: string;
    readonly summary: string;
  }>;
}

export interface FollowupLlmResult {
  readonly question: string;
  readonly expectedHook: string;
}

export const INTERVIEW_FOLLOWUP_SYSTEM_PROMPT = `당신은 대한민국 대입 학종 면접 사정관입니다. 학생의 이전 답변에서 논리적 약점·미증명 주장을 공략하는 꼬꼬무(follow-up) 질문 1개를 생성합니다.

## 좋은 세특 8단계 (면접관이 확인하는 고리)
① 지적 호기심 → ② 주제 선정(진로 연결) → ③ 탐구 내용/이론 → ④ 참고문헌 → ⑤ 결론(해결/제언) → ⑥ 교사 관찰 → ⑦ 성장 서사 → ⑧ 재탐구

## 꼬꼬무 원칙 (필수 준수)
1. **반복 금지**: 이전 depth 와 같은 각도/표현 금지. 새로운 단계 또는 각도로 전환.
2. **본인 언어 검증**: 학생이 일반 템플릿 답변을 했으면, 구체 원문 사실·사례로 파고든다.
3. **원문 근거**: 가능하면 제공된 생기부 summary 의 구체 키워드를 인용 (따옴표).
4. **약점 공격 우선**: 직전 답변에서 비약·인과단절·근거 없는 주장이 보이면 그것을 직격.
5. **템플릿 질문 금지**: "이 경험이 진로에 어떻게 도움이 될까요?" 류의 일반 질문 전부 실패.
6. **비진로교과에 진로 강요 금지**.
7. **답변 불가능한 구조 금지**: 학생이 실제로 답할 수 있도록, 원문 범위 내에서 요구.

## 출력 형식 (JSON only, no prose)
\`\`\`json
{
  "question": "다음 꼬꼬무 질문 1개 (100자 이내 권장)",
  "expectedHook": "이 질문이 드러내야 할 핵심 — 답변이 무엇을 포함해야 정합인가 (1~2문장)"
}
\`\`\`

**JSON 외 다른 설명 금지.**`;

function formatChain(chain: readonly FollowupPromptChainEntry[]): string {
  if (chain.length === 0) return "  (이전 답변 없음 — seed 질문 직후)";
  return chain
    .map(
      (c) =>
        `  Q${c.depth}: ${c.question}\n  A${c.depth}: ${c.answer?.trim() ? c.answer.trim() : "(미응답)"}`,
    )
    .join("\n");
}

function formatEvidence(
  refs: FollowupPromptInput["evidenceRefs"],
): string {
  if (refs.length === 0) return "  (생기부 근거 미제공)";
  return refs
    .slice(0, 5)
    .map((e, i) => `  [${i + 1}] (${e.recordId}) ${truncate(e.summary, 240)}`)
    .join("\n");
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

export function buildInterviewFollowupUserPrompt(
  input: FollowupPromptInput,
): string {
  const { rootQuestion, chain, nextDepth, scenario, evidenceRefs } = input;
  const lines: string[] = [];

  lines.push("## 면접 시나리오");
  lines.push(
    `  전공: ${scenario.targetMajor ?? "미설정"} / 레벨: ${scenario.targetUniversityLevel ?? "미설정"} / focus: ${scenario.focus ?? "미설정"}`,
  );

  lines.push("");
  lines.push("## Seed 질문 (depth=1)");
  lines.push(`  ${rootQuestion.trim()}`);

  lines.push("");
  lines.push("## 지금까지의 depth 체인");
  lines.push(formatChain(chain));

  lines.push("");
  lines.push("## 관련 생기부 근거");
  lines.push(formatEvidence(evidenceRefs));

  lines.push("");
  lines.push(`## 작업`);
  lines.push(
    `depth=${nextDepth} 꼬꼬무 질문 1개와 expectedHook 을 JSON 으로 반환하세요. 이전 depth 와 각도를 달리하고, 직전 답변의 약점(있다면) 을 직격하세요.`,
  );

  return lines.join("\n");
}

export function parseFollowupResponse(raw: string): FollowupLlmResult {
  const parsed = extractJson<{ question?: unknown; expectedHook?: unknown }>(raw);
  const question = typeof parsed?.question === "string" ? parsed.question.trim() : "";
  const expectedHook =
    typeof parsed?.expectedHook === "string" ? parsed.expectedHook.trim() : "";
  if (!question) throw new Error("question 필드가 비어있습니다.");
  if (question.length > 300) {
    throw new Error(`question 길이 초과 (${question.length}자)`);
  }
  return {
    question,
    expectedHook: expectedHook || "(LLM 이 hook 미제공)",
  };
}
