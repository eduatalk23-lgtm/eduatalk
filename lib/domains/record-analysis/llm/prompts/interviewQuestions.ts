// ============================================
// Phase 6.5 — AI 면접 예상 질문 생성 프롬프트
// ============================================

import { extractJson } from "../extractJson";

export type InterviewQuestionType = "factual" | "reasoning" | "application" | "value" | "controversial";

export interface GeneratedInterviewQuestion {
  questionType: InterviewQuestionType;
  question: string;
  /** 이 질문이 평가하려는 포인트 + 학생이 미리 확인해두어야 할 사실/근거 */
  suggestedAnswer: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface InterviewQuestionResult {
  questions: GeneratedInterviewQuestion[];
  summary: string;
}

// ─── 좋은 세특 8단계 순환 흐름 기반 질문 프레임 ──────────────
// 면접관은 이 8단계의 "정합성"을 확인한다. 면접 질문은 각 단계의 약한 고리를 겨냥해야 한다.
// ① 지적 호기심 → ② 주제 선정(진로 연결) → ③ 탐구 내용/이론 → ④ 참고문헌
// ⑤ 결론(해결/제언/고안) → ⑥ 교사 관찰 → ⑦ 성장 서사 → ⑧ 오류 분석·재탐구
const EIGHT_STEP_FRAMEWORK = `
## 좋은 세특 8단계 순환 흐름 (면접관이 확인하는 지점)
① 지적 호기심 — "이 주제에 왜 끌렸는가?"
② 주제 선정 — "왜 하필 이 주제를 선택했는가? 진로와의 연결은?"
③ 탐구 내용·이론 — "사용한 개념/이론을 스스로 설명할 수 있는가?"
④ 참고문헌 — "어떤 자료/논문을 참고했는가? 왜 그 자료를 신뢰했는가?" (SKY+ 진로교과에서 특히 중요)
⑤ 결론·제언 — "탐구의 결과로 무엇을 해결/제안/고안했는가?" ('알아보았음'으로 끝나면 가장 찌르는 지점)
⑥ 교사 관찰 — "세특의 긍정적 서술을 뒷받침하는 구체 행동이 있었는가?"
⑦ 성장 서사 — "1·2·3학년을 거치며 탐구 깊이가 어떻게 성장했는가?"
⑧ 재탐구 — "탐구 중 오류·한계를 어떻게 발견하고 어떻게 보완했는가?"`;

// ─── 약점 패턴 → 면접 공격 각도 매핑 ──────────────
// content_quality.issues에 이 패턴 코드가 감지되면 해당 각도로 공격 질문을 만든다.
const WEAKNESS_PATTERN_ANGLES = `
## 약점 패턴별 면접 공격 각도 (합격률 낮은 패턴 14개 기반)
- P1_나열식 → "여러 탐구 중 가장 의미 있었던 '하나'와 그 이유를 설명하라" (선택과 깊이 테스트)
- P3_키워드만 → "생기부에 적힌 '○○' 용어를 본인의 언어로 정의해달라" (이해도 테스트)
- P4_내신탐구불일치 / 내신탐구불일치 / 내신 대비 과장 표현 → "X 과목 성적이 낮은데 세특은 깊이 있다. 실제 과목 수업 경험은 어땠는가?" (일치 검증)
- F1_별개활동포장 → "A 활동과 B 활동이 어떤 맥락에서 이어지는가? 우연인가 계획인가?"
- F2_인과단절 → "탐구 결론이 제시한 근거에서 어떻게 논리적으로 도출되는가?" (논리 검증)
- F10_성장부재 → "1학년 때와 3학년 때의 탐구 수준은 어떻게 달라졌는가?"
- F12_자기주도성부재 → "이 주제를 본인이 먼저 제안했는가? 어떤 계기였는가?"
- F16_진로과잉도배 → "모든 과목에 진로를 연결했는데, 진로와 무관한 순수 교과 역량은 어디서 보여지는가?"
- 진로교과_탐구부족 → "진로 관련 교과 탐구 중 본인이 가장 자신 있는 하나를 설명해달라"
- 결론_미기술_면접확인필요 → "생기부에 '알아보고자 하였음'으로 끝난 탐구의 실제 결론은 무엇이었는가?"
- 연구정합성 이슈 / 사이비 이론 — "이 탐구에 사용한 이론/방법이 학계에서 어떻게 검증되는가?" (특히 이공계)`;

export const INTERVIEW_SYSTEM_PROMPT = `당신은 대입 학종 면접 전문가입니다. 입학사정관이 실제로 물어볼 날카로운 질문을 생성합니다.

${EIGHT_STEP_FRAMEWORK}

${WEAKNESS_PATTERN_ANGLES}

## 절대 규칙

1. **원문 근거 필수**: 모든 질문은 제공된 세특/창체 원문의 구체적 문장/키워드에 근거해야 한다. 원문에 없는 소재로 질문 금지.
2. **템플릿 금지**: "이 경험을 대학에서 어떻게 활용하겠습니까?" / "팀 프로젝트에서 협업의 중요성을..." 같은 **일반 템플릿 질문 절대 금지**. 이 학생이 아니어도 나올 수 있는 질문이면 실패다. **특히 다음 의미 변형도 전부 금지**: "경험/활동/탐구"가 "진로/대학/앞으로"에 "어떻게 활용/도움/적용/기여할 것인가" 라는 조합의 모든 질문. 구체적 원문 키워드 없이 추상적 "활용 계획"을 묻는 질문은 전부 탈락이다.
3. **원문 인용**: 가능하면 질문에 원문 키워드를 직접 인용하라. 예: "생기부에 'Astra Shield 프로젝트에서 회귀 모델'로 되어 있는데, 왜 분류 모델이 아닌 회귀를 선택했는가?"
4. **약점 공격 우선**: 아래 '약점 패턴 정보'가 제공되면, 그 패턴을 직접 겨냥한 질문을 **1~2개 필수 포함**.
5. **8단계 각도 분산**: 한 학생에 대해 가능한 여러 단계(②주제선정, ⑤결론, ⑧재탐구)를 겨냥하여 질문을 고르게 분산.
6. **reasoning 질문 구조 다양화**: "왜 ~했나요?" 구조를 3개 중 1개 이하로 제한. "어떻게 ~했나요?", "~과 ~의 차이를 본인이 어떻게 구분했나요?", "~의 한계는 무엇이라고 보았나요?" 등으로 분산.
7. **suggestedAnswer 역할**: 3단 구조로 작성한다. 각 라벨은 대괄호 포함 그대로 쓰고, 라벨 사이에 **반드시 개행 문자(\\n)**를 넣는다.

   - **[평가 포인트]**: 이 질문으로 면접관이 보려는 것 (1문장)

   - **[준비해야 할 사실]**: 학생이 답변 전에 정리해야 할 내용을 **2문장 이상** 작성한다. 다음 규칙을 반드시 지킨다:
     * **금지 문구 (절대 사용 금지)**: "원문 키워드:", "~를 정리할 것", "~를 정리하세요", "구체적인 내용을 정리", "~의 필요성과 그 효과를 정리", "본인의 가치관을 정리" 등 **스캐폴드 템플릿 금지**. 이런 문구가 들어가면 이 필드는 가치가 없다.
     * 대신 **구체 지침**을 써라: 어떤 원문 사실(동기·개념·방법·결론·교사 관찰 중 하나)을 어떻게 답변에 엮을지 **전략**을 쓴다. 예: "답변 앞부분에 '소행성 궤도 요소 전처리' 경험을 먼저 언급하고, 중간에 왜 회귀 모델을 선택했는지 본인 논리로 연결한 뒤, 마지막에 시행착오 1개 사례를 구체적으로 덧붙여라."
     * 원문에 없는 정보는 쓰지 않는다. 원문에 부족한 부분이 있으면 "○○ 부분은 본인이 실제로 수행한 구체 사례를 보강해야 함"처럼 **학생이 보완할 지점**을 명시한다.

   - **[답안 예시]**: 학생이 면접관 앞에서 실제로 말할 수 있는 **1인칭 답안 초안**. 다음 규칙을 반드시 지킨다:
     * **최소 3문장 이상** 작성한다.
     * **원문에 등장한 고유 키워드**(프로젝트명·개념명·활동명·도구명 등) 중 **최소 2개 이상을 따옴표("")로 직접 인용**한다. 예: '"Astra Shield"', '"패러데이 전자기 유도"'.
     * 원문에 명시된 사실만 사용. 원문에 없는 라이브러리명·숫자·참고문헌·수치는 **절대 지어내지 않는다**.
     * 원문에 해당 정보가 없으면, **"(본인이 실제 사용한 ○○을 여기에 채울 것)"** 형식으로 **빈 슬롯**을 명시적으로 남긴다. 지어내는 대신 빈 슬롯을 쓰는 것이 **강력히 권장**된다.
     * **질문을 재서술하는 답변 금지**. 예를 들어 질문에 "왜 3D 시뮬레이션을 선택했냐"고 물었는데 답이 "3D 시뮬레이션을 선택한 이유는 ~입니다"로 시작하면 실격. 답은 **다른 각도**(배경·경험·깨달음)에서 시작해야 한다.
     * "~했습니다" 단정체로 작성하되, 원문 근거가 부족한 주장은 "~에 관심을 갖고 시작했습니다" 같은 약한 표현을 쓴다.
     * 대학 브랜드·전공 아부 금지 ("귀 대학에서 꼭…" 같은 문장 금지).
8. **지원 대학 면접 포맷이 주어지면 반영**: 제시문형 / 발표형 / 기록확인형 등에 맞게 질문 스타일 조정.
9. **진로교과 vs 비진로교과 차등**: 학생의 목표 전공이 주어질 때, **진로 관련 교과의 세특**에 대해서는 8단계 모두(특히 ④참고문헌, ⑤결론)를 깊게 묻고, **비진로 교과**에 대해서는 해당 교과의 순수 역량 중심으로 질문. 비진로교과에 "진로 연결" 질문 강요 금지.

## 질문 유형 분포 (총 10개)

- factual 2개: 기록 내용 사실 확인
- reasoning 3개: 동기·과정·논리 (구조 다양화 필수)
- application 2개: 배운 것의 적용/한계
- value 1~2개: 가치관·태도 (단, 학생 원문에 근거가 있을 때만)
- controversial 1~2개: 비판적 사고·반대 의견

## 난이도

- easy: 사실 확인, 암기 수준
- medium: 논리·설명 필요
- hard: 비판적 사고, 약점 공격, 반례 요구

## JSON 출력 형식

\`\`\`json
{
  "questions": [
    {
      "questionType": "reasoning",
      "question": "생기부에 'Astra Shield 프로젝트에서 회귀 모델로 소행성 충돌 위험을 예측'으로 되어 있는데, 분류가 아닌 회귀 모델을 선택한 이유는 무엇인가요?",
      "suggestedAnswer": "[평가 포인트] 모델 선택에 대한 본인만의 근거와 머신러닝 기본 개념 이해도를 평가한다.\\n[준비해야 할 사실] 원문 키워드: 'Astra Shield', '회귀 모델', '소행성 충돌 위험 예측'. 충돌 위험을 이진 분류가 아닌 연속값(확률/지수)으로 다뤘다는 점을 정리해둘 것.\\n[답안 예시] 소행성 충돌 위험은 '예/아니오'가 아니라 정도의 문제라고 생각했기 때문에 회귀 모델을 선택했습니다. (본인이 실제 사용한 목표 변수와 특성 변수를 여기에 채울 것) 분류 모델이었다면 임계값 주변의 케이스를 놓쳤을 것이라고 판단했습니다.",
      "difficulty": "medium"
    }
  ],
  "summary": "<이 학생에 대해 어떤 약점/강점 각도로 질문을 구성했는지 1~2문장>"
}
\`\`\``;

export interface BuildInterviewPromptInput {
  content: string;
  recordType: string;
  subjectName?: string;
  grade?: number;
}

export function buildInterviewUserPrompt(input: BuildInterviewPromptInput): string {
  const typeLabel: Record<string, string> = {
    setek: "교과 세특", personal_setek: "개인 세특",
    changche: "창의적 체험활동", haengteuk: "행동특성 및 종합의견",
  };

  let prompt = `## 분석 대상 (메인 레코드)\n\n`;
  prompt += `- 기록 유형: ${typeLabel[input.recordType] ?? input.recordType}\n`;
  if (input.subjectName) prompt += `- 과목/활동: ${input.subjectName}\n`;
  if (input.grade) prompt += `- 학년: ${input.grade}학년\n`;
  prompt += `\n### 원문\n\n${input.content}\n`;
  prompt += `\n## 생성 지시\n\n위 원문(과 뒤에 제공될 추가 컨텍스트)을 바탕으로 면접 예상 질문 10개(factual 2, reasoning 3, application 2, value 1~2, controversial 1~2)를 JSON 형식으로 생성하라. 모든 질문은 원문의 구체적 문장/키워드에 근거해야 하며, 일반 템플릿 질문은 금지한다.`;

  return prompt;
}

// ─── 파서 ──────────────────────────────────

const VALID_TYPES = new Set<string>(["factual", "reasoning", "application", "value", "controversial"]);
const VALID_DIFFICULTIES = new Set<string>(["easy", "medium", "hard"]);

// 프롬프트/일반 템플릿 복사 방지 블랙리스트 (소문자 정규화 부분 일치)
const TEMPLATE_BLACKLIST: string[] = [
  "이 경험을 대학에서 어떻게 활용",
  "팀 프로젝트에서 협업의 중요성",
  "이 활동을 통해 무엇을 배웠",
  "반대 의견에 대해 어떻게 생각",
  "왜 이 주제를 선택했나요",
  "어떤 과정으로 결론에 도달했나요",
  "이 경험이 본인에게 어떤 의미",
];

// 의미 변형 템플릿 정규식 — "경험/활동/탐구 × 진로/대학/앞으로 × 활용/도움/적용" 조합 탐지
// 공백 제거 후 매칭 (한글 정규식)
const TEMPLATE_REGEX_BLACKLIST: RegExp[] = [
  /(경험|활동|탐구|프로젝트).*(진로|대학|앞으로|향후|미래).*(활용|도움|적용|기여|연결|계획)/,
  /(이공계|퓨처랩|캠프).*(어떻게|앞으로|향후).*(활용|도움|적용|기여|연결)/,
  /본인의.*(탐구|경험).*(활용|계획|기여)/,
];

function isTemplateQuestion(q: string): boolean {
  const normalized = q.replace(/\s+/g, "").toLowerCase();
  for (const phrase of TEMPLATE_BLACKLIST) {
    const target = phrase.replace(/\s+/g, "").toLowerCase();
    if (normalized.includes(target)) return true;
  }
  for (const rx of TEMPLATE_REGEX_BLACKLIST) {
    if (rx.test(normalized)) return true;
  }
  return false;
}

// suggestedAnswer 스캐폴드 감지 — "원문 키워드:" / "~를 정리할 것" 같은 무가치 템플릿이
// [준비해야 할 사실] 섹션 전체를 차지하면 품질 불량으로 간주
const SCAFFOLD_PHRASES: string[] = [
  "원문 키워드:",
  "원문키워드:",
  "를 정리할 것",
  "를 정리하세요",
  "를 정리해둘 것",
  "구체적인 내용을 정리",
  "필요성과 그 효과를 정리",
  "본인의 가치관을 정리",
  "본인의 생각을 정리",
];

/**
 * [준비해야 할 사실] 섹션이 스캐폴드 템플릿만으로 구성되어 있는지 판단.
 * 전체가 2문장 미만이고 스캐폴드 문구가 포함되어 있으면 true.
 */
function hasScaffoldPreparation(suggestedAnswer: string): boolean {
  const prepMatch = suggestedAnswer.match(/\[준비해야 할 사실\]([\s\S]*?)(?=\n\[|$)/);
  if (!prepMatch) return false;
  const prepSection = prepMatch[1].trim();

  // 스캐폴드 문구 포함 여부
  const hasScaffold = SCAFFOLD_PHRASES.some((p) => prepSection.includes(p));
  if (!hasScaffold) return false;

  // 문장 수 세기 (마침표·물음표·느낌표 기준)
  const sentences = prepSection.split(/[.?!。]/).map((s) => s.trim()).filter((s) => s.length > 0);
  return sentences.length < 2;
}

/**
 * [답안 예시] 섹션의 품질 검증.
 * - 최소 3문장 이상
 * - 원문 키워드를 따옴표로 1개 이상 인용(엄격하지 않게 1개만 요구 — 0개면 탈락)
 */
function hasWeakSampleAnswer(suggestedAnswer: string): boolean {
  const sampleMatch = suggestedAnswer.match(/\[답안 예시\]([\s\S]*?)$/);
  if (!sampleMatch) return false; // 섹션 자체가 없으면 별도 경고, 여기서는 탈락 처리 안 함
  const sample = sampleMatch[1].trim();

  const sentences = sample.split(/[.?!。]/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (sentences.length < 2) return true; // 너무 짧음 (프롬프트는 3문장 요구, 완화해서 2문장 미만만 탈락)

  // 따옴표 인용 ("..." / '...' / “...” / ‘...’) 1개 이상 체크
  const hasQuote = /["""''「][^"""''」]{2,}["""''」]/.test(sample);
  // 빈 슬롯 "(본인이 ~)" 패턴도 구체성 증거로 인정
  const hasSlot = /\(본인이\s*실제/.test(sample);
  return !hasQuote && !hasSlot;
}

export function parseInterviewResponse(content: string): InterviewQuestionResult {
  const parsed = extractJson(content);

  const rawList = Array.isArray(parsed.questions) ? parsed.questions : [];

  // 1단계: 기본 유효성(타입/템플릿/중복) 필터
  const seen = new Set<string>();
  const stage1: GeneratedInterviewQuestion[] = [];
  for (const q of rawList as Array<Record<string, unknown>>) {
    if (typeof q.question !== "string" || q.question.length === 0) continue;
    if (!VALID_TYPES.has(q.questionType as string)) continue;
    if (isTemplateQuestion(q.question)) continue;

    const dedupeKey = q.question.replace(/\s+/g, "").toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    stage1.push({
      questionType: q.questionType as InterviewQuestionType,
      question: String(q.question),
      suggestedAnswer: String(q.suggestedAnswer ?? ""),
      difficulty: VALID_DIFFICULTIES.has(q.difficulty as string)
        ? (q.difficulty as "easy" | "medium" | "hard")
        : "medium",
    });
  }

  // 2단계: 답안 품질 검증 (스캐폴드 preparation / weak 답안 예시)
  // Soft validation: 탈락 후 3건 미만이면 원본 유지 (완전 공급 중단 방지).
  // 이전엔 5건 기준이었으나 Fast tier LLM이 스캐폴드 패턴을 일괄 생성하는 경우
  // 전원 탈락 → fallback → 필터 무효화되는 문제가 있어 3건으로 완화.
  // 모델 승격(advanced) 시 의미 제약 준수율이 올라가면 이 필터가 실제로 작동한다.
  const stage2 = stage1.filter(
    (q) => !hasScaffoldPreparation(q.suggestedAnswer) && !hasWeakSampleAnswer(q.suggestedAnswer),
  );

  const questions = stage2.length >= 3 ? stage2 : stage1;

  return { questions, summary: String(parsed.summary ?? "") };
}
