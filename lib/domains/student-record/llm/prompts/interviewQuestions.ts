// ============================================
// Phase 6.5 — AI 면접 예상 질문 생성 프롬프트
// ============================================

import { extractJson } from "../extractJson";

export type InterviewQuestionType = "factual" | "reasoning" | "application" | "value" | "controversial";

export interface GeneratedInterviewQuestion {
  questionType: InterviewQuestionType;
  question: string;
  suggestedAnswer: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface InterviewQuestionResult {
  questions: GeneratedInterviewQuestion[];
  summary: string;
}

const TYPE_DESC = `
- factual (사실형, 20%): 기록된 활동 내용 확인 질문 — "~를 했다고 되어있는데, 구체적으로 설명해주세요"
- reasoning (추론형, 30%): 동기와 과정 탐구 질문 — "왜 이 주제를 선택했나요?", "어떤 과정으로 결론에 도달했나요?"
- application (적용형, 20%): 배운 것의 활용 질문 — "이 경험을 대학에서 어떻게 활용하겠습니까?"
- value (가치관형, 15%): 가치관과 태도 질문 — "이 활동을 통해 무엇을 배웠나요?"
- controversial (심층형, 15%): 비판적 사고 질문 — "반대 의견에 대해 어떻게 생각하나요?"`;

export const INTERVIEW_SYSTEM_PROMPT = `당신은 대입 면접 전문가입니다. 학생의 생기부 기록을 바탕으로 면접 예상 질문을 생성합니다.

## 질문 유형 (5가지)
${TYPE_DESC}

## 규칙

1. 총 10개 질문을 생성합니다: factual 2개, reasoning 3개, application 2개, value 1~2개, controversial 1~2개.
2. 질문은 반드시 주어진 텍스트의 **구체적 내용**에 기반해야 합니다.
3. 각 질문에 예시 답변(suggestedAnswer)을 2-3문장으로 제공합니다.
4. 난이도: easy(기본 확인), medium(심화 설명 필요), hard(비판적 사고 필요).
5. JSON 형식으로만 응답합니다.

## JSON 출력 형식

\`\`\`json
{
  "questions": [
    {
      "questionType": "factual",
      "question": "생기부에 CT 촬영 원리를 탐구했다고 되어있는데, 어떤 수학적 원리가 적용되나요?",
      "suggestedAnswer": "CT 촬영은 연립방정식의 원리를 활용합니다. X선을 여러 각도에서 투사하여...",
      "difficulty": "medium"
    }
  ],
  "summary": "의료영상 탐구와 수학적 응용에 초점을 맞춘 질문을 생성했습니다."
}
\`\`\``;

export function buildInterviewUserPrompt(input: {
  content: string;
  recordType: string;
  subjectName?: string;
  grade?: number;
}): string {
  const typeLabel: Record<string, string> = {
    setek: "교과 세특", personal_setek: "개인 세특",
    changche: "창의적 체험활동", haengteuk: "행동특성 및 종합의견",
  };

  let prompt = `## 분석 대상\n\n`;
  prompt += `- 기록 유형: ${typeLabel[input.recordType] ?? input.recordType}\n`;
  if (input.subjectName) prompt += `- 과목: ${input.subjectName}\n`;
  if (input.grade) prompt += `- 학년: ${input.grade}학년\n`;
  prompt += `\n## 텍스트 원문\n\n${input.content}\n\n`;
  prompt += `위 기록을 바탕으로 면접 예상 질문 10개를 JSON으로 생성해주세요.`;

  return prompt;
}

// ─── 파서 ──────────────────────────────────

const VALID_TYPES = new Set<string>(["factual", "reasoning", "application", "value", "controversial"]);
const VALID_DIFFICULTIES = new Set<string>(["easy", "medium", "hard"]);

export function parseInterviewResponse(content: string): InterviewQuestionResult {
  const parsed = extractJson(content);

  const questions: GeneratedInterviewQuestion[] = (parsed.questions ?? [])
    .filter((q: Record<string, unknown>) =>
      typeof q.question === "string" &&
      q.question.length > 0 &&
      VALID_TYPES.has(q.questionType as string),
    )
    .map((q: Record<string, unknown>) => ({
      questionType: q.questionType as InterviewQuestionType,
      question: String(q.question),
      suggestedAnswer: String(q.suggestedAnswer ?? ""),
      difficulty: VALID_DIFFICULTIES.has(q.difficulty as string) ? q.difficulty as "easy" | "medium" | "hard" : "medium",
    }));

  return { questions, summary: String(parsed.summary ?? "") };
}
