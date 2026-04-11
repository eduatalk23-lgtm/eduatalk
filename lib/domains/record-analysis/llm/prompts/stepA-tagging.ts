// ============================================
// Phase 1 (Level 4): Step A — 구간분류 + 태그추출
// 3-Step 분해의 첫 단계: 원문 구절 인용 + 역량 태깅 + 신뢰도
// ============================================

import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import type { CompetencyItemCode } from "@/lib/domains/student-record/types";
import type { HighlightAnalysisInput, StepATaggingResult, TagWithUncertainty, SectionWithUncertainty } from "../types";
import { extractJson } from "../extractJson";
import { grade5To9 } from "@/lib/domains/student-record/grade-normalizer";

/** rankGrade(number|string) → 9등급 숫자로 정규화 */
function toGrade9(rg: number | string): number {
  if (typeof rg === "string") return grade5To9(rg);
  return rg;
}

/** rankGrade 표시 라벨 */
function gradeLabel(rg: number | string): string {
  if (typeof rg === "string") return `${rg}(≈${grade5To9(rg)}등급)`;
  return `${rg}등급`;
}

// 역량 항목 스키마 (루브릭 질문 제외 — Step B에서만 사용)
const COMPETENCY_SCHEMA_LITE = COMPETENCY_ITEMS.map((item) =>
  `- ${item.code} (${item.label}): ${item.evalTarget}`,
).join("\n");

export const STEP_A_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 생기부 세특/창체/행특 텍스트를 분석하여 **원문의 어느 구절이 어떤 역량에 해당하는지** 정확히 표시합니다.

## 역량 체계 (3대 역량 × 10개 항목)

${COMPETENCY_SCHEMA_LITE}

## 분석 규칙

1. **원문 정확 인용**: highlight에 원문 구절을 **그대로** 인용. 단어를 바꾸거나 요약하지 않습니다.
2. **구간 분류**: 세특은 3구간으로, 각 구간의 원문을 sectionText에 포함:
   - "학업태도": 수업 참여, 발표, 과제 성실성, 학습 의지
   - "학업수행능력": 개념 이해, 문제 해결력, 교과 성취도
   - "탐구활동": 심화 탐구, 보고서, 독서 연계, 실험, 프로젝트
   sectionText는 원문 그대로, 문장 단위 빠짐없이, 순서 유지. 창체/행특은 "전체". 100자 미만도 "전체".
3. **다중 태그**: 하나의 구절이 여러 역량에 해당할 수 있습니다.
4. **빠짐없이 태깅 (커버리지 최우선)**: 텍스트의 **모든 활동·성과·태도 구절**을 빠짐없이 태깅합니다. 짧은 언급이라도 역량 관련이면 반드시 포함. **누락보다 needs_review 태깅이 낫습니다.**
5. **평가 구분 (evaluation)**:
   - positive: 구체적 성과·결과가 동반된 경우 (예: "보고서를 제출하고 우수한 평가")
   - negative: 부족함을 시사 (예: "기본 개념 이해가 미흡")
   - needs_review: 활동은 언급되나 성과/깊이 불확실. "관심을 보였다", "참여하였다", "노력하는 모습", "알게 되었다" 등은 needs_review
6. **분류 주의사항**:
   - academic_achievement: 교과 성적(등급/석차)에 한정. 체육 실기·예술 작품 제외
   - integrity vs leadership: 성실 이행 → integrity, 주도적 변화/조율 → leadership
   - career_exploration: 목표 전공 제공 시 관련성 반영 (무관한 탐색 → needs_review)
   - career_course_effort/achievement: 이수율·성적 데이터로 별도 산정. 텍스트에서 태깅하지 마세요
   - 교양 교과·창체·행특도 동일 역량 체계로 빠짐없이 분석
7. **신뢰도 (confidence)**: 각 태그에 0.0~1.0 사이 신뢰도를 부여합니다:
   - 0.9~1.0: 명확한 근거, 역량 분류가 확실
   - 0.7~0.8: 합리적 판단이나 다른 해석도 가능
   - 0.5~0.6: 구절이 모호하거나 역량 분류가 불확실
   - 0.3~0.4: 추측에 가까움, 추가 검증 필요

### 교사 기재 스타일 관용 원칙

학생부는 **학교 선생님**이 작성합니다. 선생님마다 기재 역량과 관심도가 다릅니다:
- "~임을 설명함"으로 끝나는 탐구 → **무조건 결론 미완이 아님**. 앞의 기재 내용에서 실제 수행이 추론 가능하면 해당 역량에 태깅 (confidence 0.6~0.7)
- 평가 시에는 관용적 해석 적용

## JSON 출력 형식

\`\`\`json
{
  "sections": [
    {
      "sectionType": "학업태도",
      "sectionText": "방학 동안 스스로 모의고사를 풀면서 문제 해결과 개념 이해에 몰두함.",
      "tags": [
        {
          "competencyItem": "academic_attitude",
          "evaluation": "positive",
          "highlight": "방학 동안 스스로 모의고사를 풀면서 문제 해결과 개념 이해에 몰두",
          "reasoning": "자기주도적 학습 태도를 보여줌",
          "confidence": 0.92
        }
      ],
      "needsReview": false
    }
  ]
}
\`\`\``;

// ============================================
// 사용자 프롬프트 빌더
// ============================================

const TYPE_LABEL: Record<string, string> = {
  setek: "교과 세특(세부능력 및 특기사항)",
  personal_setek: "개인 세특(학교자율과정)",
  changche: "창의적 체험활동",
  haengteuk: "행동특성 및 종합의견",
};

export function buildStepAUserPrompt(input: HighlightAnalysisInput): string {
  let prompt = `## 분석 대상\n\n`;
  prompt += `- 기록 유형: ${TYPE_LABEL[input.recordType] ?? input.recordType}\n`;
  if (input.subjectName) prompt += `- 과목: ${input.subjectName}\n`;
  if (input.grade) prompt += `- 학년: ${input.grade}학년\n`;
  if (input.careerContext?.targetMajor) prompt += `- 목표 전공: ${input.careerContext.targetMajor}\n`;
  prompt += `\n## 텍스트 원문\n\n${input.content}\n\n`;
  prompt += `위 텍스트의 핵심 구절을 빠짐없이 분석하여, 각 구절이 어떤 역량에 해당하는지 원문을 정확히 인용하여 JSON으로 응답하세요. 각 태그에 confidence(0.0~1.0)를 반드시 포함하세요.`;

  if ((input.recordType === "setek" || input.recordType === "personal_setek") && input.content.length >= 100) {
    prompt += `\n\n이 텍스트는 교과 세특이므로 3구간(학업태도/학업수행능력/탐구활동)으로 분리하여 각 구간의 원문을 sectionText에 포함하세요. 모든 문장이 빠짐없이 어느 한 구간에 포함되어야 합니다.`;
  }

  // Layer 0: 학생 프로필 카드
  if (input.profileCard) {
    prompt += `\n\n${input.profileCard}`;
  }

  // 진로 컨텍스트 (태깅 분류에 필요한 최소한만)
  if (input.careerContext) {
    const { targetMajor, takenSubjects } = input.careerContext;
    prompt += `\n\n## 참고 데이터\n`;
    prompt += `- 목표 전공: ${targetMajor}\n`;
    prompt += `- 이수 과목 (${takenSubjects.length}개): ${takenSubjects.join(", ")}\n`;
    prompt += `\n위 데이터를 career_exploration 태깅 시 참고하세요 (전공 관련성 판단).`;
  }

  return prompt;
}

// ============================================
// 응답 파서
// ============================================

const VALID_ITEMS = new Set<string>(COMPETENCY_ITEMS.map((i) => i.code));
const VALID_EVALS = new Set(["positive", "negative", "needs_review"]);
const VALID_SECTIONS = new Set(["학업태도", "학업수행능력", "탐구활동", "전체"]);

const EMPTY_RESULT: StepATaggingResult = { sections: [], coveredItems: [], overallConfidence: 0 };

export function parseStepAResponse(content: string): StepATaggingResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(content);
  } catch (e) {
    throw new SyntaxError(`Step A JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== "object") return EMPTY_RESULT;
  const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];

  const sections: SectionWithUncertainty[] = [];
  const coveredItemSet = new Set<CompetencyItemCode>();

  for (const s of rawSections) {
    if (!s || typeof s !== "object") continue;
    const sectionType = VALID_SECTIONS.has(s.sectionType) ? s.sectionType : "전체";
    const tags: TagWithUncertainty[] = [];

    for (const t of s.tags ?? []) {
      if (!VALID_ITEMS.has(t.competencyItem)) continue;
      if (!VALID_EVALS.has(t.evaluation)) continue;
      if (!t.highlight || typeof t.highlight !== "string") continue;

      const confidence = typeof t.confidence === "number"
        ? Math.max(0, Math.min(1, t.confidence))
        : 0.5; // LLM이 누락 시 기본값

      tags.push({
        competencyItem: t.competencyItem as CompetencyItemCode,
        evaluation: t.evaluation,
        highlight: t.highlight,
        reasoning: String(t.reasoning ?? ""),
        confidence,
      });
      coveredItemSet.add(t.competencyItem as CompetencyItemCode);
    }

    if (tags.length > 0) {
      sections.push({
        sectionType: sectionType as SectionWithUncertainty["sectionType"],
        ...(typeof s.sectionText === "string" && s.sectionText.length > 0 ? { sectionText: s.sectionText } : {}),
        tags,
        needsReview: s.needsReview === true,
      });
    }
  }

  const coveredItems = [...coveredItemSet];

  return {
    sections,
    coveredItems,
    overallConfidence: 0, // 오케스트레이터에서 계산
  };
}
