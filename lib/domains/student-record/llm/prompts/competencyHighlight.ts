// ============================================
// 세특 인라인 하이라이트 + 역량 분석 프롬프트
// Phase 6.1 — 원문 구절 인용 기반 역량 태깅
// ============================================

import { COMPETENCY_ITEMS, COMPETENCY_RUBRIC_QUESTIONS } from "../../constants";
import {
  formatFailPatternsForPrompt,
  formatSetekFlowEvaluation,
  CAREER_SUBJECT_MIN_STAGES,
  QUALITY_SCORE_FORMULA,
} from "../../evaluation-criteria/defaults";
import type { HighlightAnalysisInput, HighlightAnalysisResult, AnalyzedSection, HighlightTag, BatchHighlightInput, ContentQualityScore } from "../types";
import type { CompetencyItemCode, CompetencyGrade } from "../../types";
import { extractJson } from "../extractJson";
import { grade5To9 } from "../../grade-normalizer";

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

const COMPETENCY_SCHEMA = COMPETENCY_ITEMS.map((item) => {
  const questions = COMPETENCY_RUBRIC_QUESTIONS[item.code];
  return `- ${item.code} (${item.label}): ${item.evalTarget}\n  루브릭: ${questions.join(" / ")}`;
}).join("\n");

export const HIGHLIGHT_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 생기부 세특/창체/행특 텍스트를 분석하여 **원문의 어느 구절이 어떤 역량에 해당하는지** 정확히 표시합니다.

## 역량 체계 (3대 역량 × 10개 항목)

${COMPETENCY_SCHEMA}

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
   - career_course_effort/achievement: 이수율·성적 데이터로 별도 산정. 텍스트에서 태깅하지 마세요. 전공 관련 심화 과목이 개설되었음에도 이수하지 않은 것이 감지되면 feedback에 "전공 관련 심화 과목이 개설되었음에도 자발적으로 이수하지 않은 것인지 추가 확인이 필요합니다" 안내 포함
   - 교양 교과·창체·행특도 동일 역량 체계로 빠짐없이 분석
7. **루브릭 등급 (Bottom-Up) — 반드시 산출**:
   a) 태그가 1개라도 발견된 역량 항목의 루브릭 질문을 **개별 평가** (questionIndex 0-based)
   b) 각 질문에 등급(A+/A-/B+/B/B-/C) + 한 문장 근거. 근거 없는 질문은 생략
   c) 항목 종합 등급 = 질문 등급의 평균 반올림. **등급을 생략하지 마세요**
   d) 등급 기준: A+(구체적 성과+심화+독창) / A-(우수하나 일부 부족) / B+(평균 이상, 차별점 부족) / B(기본, "참여함" 수준) / B-(피상적) / C(근거 없음)

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
          "reasoning": "자기주도적 학습 태도를 보여줌"
        }
      ],
      "needsReview": false
    },
    {
      "sectionType": "탐구활동",
      "sectionText": "연립방정식과 CT 촬영 원리에 대해 연구하여 탐구 보고서를 제출함.",
      "tags": [
        {
          "competencyItem": "academic_inquiry",
          "evaluation": "positive",
          "highlight": "연립방정식과 CT 촬영 원리에 대해 연구하여 탐구 보고서를 제출",
          "reasoning": "교과 심화 탐구의 구체적 성과"
        }
      ],
      "needsReview": false
    },
    {
      "sectionType": "탐구활동",
      "sectionText": "진로 스피치 활동에서 천문학과에 대해 구체적으로 소개하며 희망 진로와 포부를 표현함. 입시 제도를 탐색하며 학업 계획을 수립함.",
      "tags": [
        {
          "competencyItem": "career_exploration",
          "evaluation": "positive",
          "highlight": "진로 스피치 활동에서 천문학과에 대해 구체적으로 소개하며 희망 진로와 포부를 표현",
          "reasoning": "구체적 진로 목표 수립과 발표를 통한 표현"
        },
        {
          "competencyItem": "community_integrity",
          "evaluation": "positive",
          "highlight": "입시 제도를 탐색하며 학업 계획을 수립",
          "reasoning": "자기 주도적 계획 수립과 실행 의지"
        }
      ],
      "needsReview": false
    }
  ],
  "competencyGrades": [
    {
      "item": "academic_attitude",
      "grade": "B+",
      "reasoning": "자기주도적 학습은 보이나 수업 참여 근거 부족",
      "rubricScores": [
        { "questionIndex": 0, "grade": "A-", "reasoning": "자발적 학습 의지가 명확히 드러남" },
        { "questionIndex": 1, "grade": "B+", "reasoning": "자기주도적 노력은 보이나 방법 제시 부족" },
        { "questionIndex": 2, "grade": "B", "reasoning": "수업 참여에 대한 직접적 근거 미흡" }
      ]
    }
  ],
  "summary": "학업 탐구력이 두드러지며 진로 연결이 우수함",
  "contentQuality": {
    "specificity": 3,
    "coherence": 4,
    "depth": 3,
    "grammar": 5,
    "scientificValidity": 4,
    "overallScore": 70,
    "issues": ["구체적 성과 수치 부족"],
    "feedback": "탐구 과정은 잘 드러나나 결과와 배운 점을 구체적 수치나 사례로 보완하면 좋겠습니다."
  }
}
\`\`\`

## 추가: 텍스트 품질 평가

역량 분석과 함께, 이 텍스트의 **작성 품질**도 평가하세요.

### 좋은 세특의 8단계 흐름 (평가 기준)

아래 흐름이 얼마나 충족되는지를 specificity/coherence/depth/scientificValidity 평가에 반영하세요:
${formatSetekFlowEvaluation()}

### 합격률 낮은 세특 패턴 감지 (issues에 반영)

아래 패턴이 발견되면 issues 배열에 해당 코드를 포함하세요:
${formatFailPatternsForPrompt()}

### 내신-세특 교차 검증 (필수)

성적 데이터가 제공된 경우, **세특 서술과 실제 성적의 정합성을 반드시 검증**하세요:
- "우수한 학업 성취"라는 서술이 있는데 해당 교과 내신이 3등급 이하 → needs_review + "내신 대비 과장 표현" 지적
- 내신 따로, 세특 따로 평가하면 안 됩니다. 세특 탐구역량과 해당 교과 내신 성적이 부합하는지 확인
- 내신이 낮은데 세특에서 대학원급 심화 → P4_내신탐구불일치 (critical)
- 내신이 높지 않아도 세특에서 성실한 탐구 → 학업태도로는 인정 가능

### 교사 기재 스타일 관용 원칙

학생부는 학생이나 전문가가 아닌 **학교 선생님**이 작성합니다. 선생님마다 기재 역량과 관심도가 달라 동일한 활동도 기재 수준이 천차만별입니다:
- "~임을 설명함"으로 끝나는 탐구 → **무조건 결론 미완이 아님**. 앞의 기재 내용에서 실제 수행이 추론 가능하면 면접 검증 포인트로 분류
- issues에 기재할 때: "결론_미기술_면접확인필요" (결론 부재가 아님, 면접에서 확인 필요한 포인트)
- 평가(현재 기록 분석) 시에는 관용적 해석, 설계(다음 학기 방향) 시에는 8단계 이상향 적용

### 진로교과 세특 가중 평가

진로(계열) 관련 교과의 세특인 경우 (목표 전공이 제공된 경우):
- **depth 기대치 상향**: 진로교과에서는 depth 3점이 비진로교과의 4점에 해당. 진로교과인데 depth ≤ 2이면 issues에 "진로교과_탐구부족" 추가
- **8단계 흐름 분석 필수**: 진로교과 세특은 최소 ${CAREER_SUBJECT_MIN_STAGES.map((s) => `${"①②③④⑤⑥⑦⑧"[s - 1]}`).join("")} 단계 충족 여부를 점검. 단, ⑤결론과 ⑧오류→재탐구는 **+@ 가산 요소**이며, 없다고 감점하지 않음
- 비진로교과(국어/체육/음악 등)에서는 교과 역량 중심 평가가 정상이며 진로 연결 없어도 감점하지 않음

### 5축 점수 기준

- **specificity** (0-5): 구체적 사례·근거·성과가 포함된 정도
  - 0: "수업에 참여함" 수준의 모호한 기술
  - 3: 활동 내용이 있으나 구체적 성과 부족
  - 5: 구체적 탐구 과정, 결과, 배운 점이 명확

- **coherence** (0-5): 8단계 흐름의 논리적 연결 + 학년별 성장 구조
  - 0: 나열식, 연결 없음 (P1_나열식)
  - 2: 활동은 있으나 결론과 인과 단절 (F2_인과단절)
  - 3: 부분적 연결 (일부 단계 누락)
  - 4: 호기심→탐구→결론→성장의 자연스러운 서사 흐름
  - 5: 위 흐름 + 오류→재탐구 순환 + 학년별 성장 구조 충족
  - **학년별 성장 구조 기준** (여러 학년 데이터가 있는 경우 반영):
    - 고1: 넓은 씨앗 뿌리기 (기술/사회동향 파악, 진로에 대한 다양한 분야 관심)
    - 고2: 1학년 중 관심 주제를 선별하여 발전/심화학습 (실험 보완, 깊이 있는 탐구)
    - 고3: 2학년 핵심 내용을 기술/원리/정책/산출물로 더 심화 + 사회적 확장 범위까지 제언
    - 학년 간 깊이가 동일하면(F10_성장부재) coherence 감점

- **depth** (0-5): 탐구·분석의 깊이
  - 0: 표면적 기술만
  - 3: 탐구 시도는 있으나 피상적
  - 5: 심층 분석, 교과 연계, 확장적 사고, 자기만의 해석

- **grammar** (0-5): 문법·맞춤법·표현의 적절성
  - 5: 완벽
  - 3: 약간의 어색함
  - 0: 심각한 문법 오류

- **scientificValidity** (0-5): 연구 정합성 (이공계·인문사회 공통)
  - 0: 심각한 사실 오류 또는 논리적 비약 (F4/F5/F6 해당)
  - 2: 개념 혼동이 있으나 치명적이지 않음
  - 3: 대체로 정확하나 일부 비약 또는 비교군 부적절
  - 5: 개념 정확, 실험/연구 설계 타당, 결론 비자명, 가설-결론 정합
  - **이공계**: 개념 정확성, 실험·모델링 설계 타당성, 결론 비자명성
  - **인문·사회계**: 문제정의→질문설정→연구설계(양적: 질문지법·통계 / 질적: 면접법·참여관찰법·문헌연구법)→자료분석→결론과 제언의 논리적 전개, 한계점 인식 및 대응방안 도출

- **overallScore** (0-100): 종합 = ${QUALITY_SCORE_FORMULA}
- **issues**: 발견된 품질 문제 목록. 위 패턴 코드(P1~F16) + 자유 기술 (예: "동어반복", "구체 사례 부족") 혼용 가능
- **feedback**: 개선을 위한 1-2문장 피드백
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

export function buildHighlightUserPrompt(input: HighlightAnalysisInput): string {
  let prompt = `## 분석 대상\n\n`;
  prompt += `- 기록 유형: ${TYPE_LABEL[input.recordType] ?? input.recordType}\n`;
  if (input.subjectName) prompt += `- 과목: ${input.subjectName}\n`;
  if (input.grade) prompt += `- 학년: ${input.grade}학년\n`;
  if (input.careerContext?.targetMajor) prompt += `- 목표 전공: ${input.careerContext.targetMajor}\n`;
  prompt += `\n## 텍스트 원문\n\n${input.content}\n\n`;
  prompt += `위 텍스트의 핵심 구절을 빠짐없이 분석하여, 각 구절이 어떤 역량에 해당하는지 원문을 정확히 인용하여 JSON으로 응답하세요. **등급 인플레이션에 주의하세요.** 구체적 성과 없이 "참여함/관심을 보임" 수준은 B~B+ 범위입니다.`;

  if ((input.recordType === "setek" || input.recordType === "personal_setek") && input.content.length >= 100) {
    prompt += `\n\n이 텍스트는 교과 세특이므로 3구간(학업태도/학업수행능력/탐구활동)으로 분리하여 각 구간의 원문을 sectionText에 포함하세요. 모든 문장이 빠짐없이 어느 한 구간에 포함되어야 합니다.`;
  }

  // 진로 역량 + 학업성취도 평가용 컨텍스트
  if (input.careerContext) {
    const { targetMajor, takenSubjects, relevantScores, gradeTrend } = input.careerContext;
    prompt += `\n\n## 참고 데이터\n`;
    prompt += `- 목표 전공: ${targetMajor}\n`;
    prompt += `- 이수 과목 (${takenSubjects.length}개): ${takenSubjects.join(", ")}\n`;
    if (relevantScores.length > 0) {
      prompt += `- 전공 관련 과목 성적:\n`;
      for (const s of relevantScores) {
        prompt += `  · ${s.subjectName}: ${gradeLabel(s.rankGrade)}\n`;
      }
    }

    // 학기별 성적 추이 (academic_achievement Q3 "학기별/학년별 성적의 추이" 평가용)
    if (gradeTrend && gradeTrend.length > 0) {
      // 학기별 평균 등급 계산
      const termMap = new Map<string, { sum: number; count: number; subjects: string[] }>();
      for (const s of gradeTrend) {
        const key = `${s.grade}학년 ${s.semester}학기`;
        const entry = termMap.get(key) ?? { sum: 0, count: 0, subjects: [] };
        entry.sum += toGrade9(s.rankGrade);
        entry.count++;
        entry.subjects.push(`${s.subjectName}(${gradeLabel(s.rankGrade)})`);
        termMap.set(key, entry);
      }
      prompt += `\n- **학기별 성적 추이** (academic_achievement Q3 "학기별/학년별 성적 추이" 평가에 활용):\n`;
      for (const [term, data] of termMap) {
        const avg = (data.sum / data.count).toFixed(1);
        prompt += `  · ${term}: 평균 ${avg}등급 (${data.subjects.join(", ")})\n`;
      }
    }

    prompt += `\n위 데이터를 활용하세요:\n`;
    prompt += `- career_course_effort/achievement: 이수율·성적 데이터 기반 평가\n`;
    prompt += `- academic_achievement Q3 (성적 추이): 학기별 평균 등급 변화 패턴 평가\n`;
    prompt += `- academic_achievement Q0~Q2: 텍스트 + 성적 데이터 함께 참고\n`;
  }

  return prompt;
}

// ============================================
// 응답 파서
// ============================================

const VALID_ITEMS = new Set<string>(COMPETENCY_ITEMS.map((i) => i.code));
const VALID_EVALS = new Set(["positive", "negative", "needs_review"]);
const VALID_SECTIONS = new Set(["학업태도", "학업수행능력", "탐구활동", "전체"]);
const VALID_GRADES = new Set(["A+", "A-", "B+", "B", "B-", "C"]);

const EMPTY_RESULT: HighlightAnalysisResult = { sections: [], competencyGrades: [], summary: "" };

/** 숫자 범위 클램프 헬퍼 */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** raw 응답에서 contentQuality 안전 추출 (undefined = LLM이 제공 안 함) */
function extractContentQuality(raw: Record<string, unknown>): ContentQualityScore | undefined {
  const cq = raw.contentQuality;
  if (!cq || typeof cq !== "object") return undefined;
  const c = cq as Record<string, unknown>;

  // 범위 초과 감지 (clamp 전 — LLM 응답 이상 감지)
  const rawAxes: Record<string, number> = {
    specificity: Number(c.specificity) || 0,
    coherence: Number(c.coherence) || 0,
    depth: Number(c.depth) || 0,
    grammar: Number(c.grammar) || 0,
  };
  if (c.scientificValidity != null) rawAxes.scientificValidity = Number(c.scientificValidity) || 0;
  if (Object.values(rawAxes).some((v) => v < 0 || v > 5)) {
    console.warn("[ContentQuality] 축 점수 범위 초과 (유효범위 0-5):", rawAxes);
  }

  const sp = clamp(Number(c.specificity) || 0, 0, 5);
  const co = clamp(Number(c.coherence) || 0, 0, 5);
  const dp = clamp(Number(c.depth) || 0, 0, 5);
  const gm = clamp(Number(c.grammar) || 0, 0, 5);
  const sv = c.scientificValidity != null ? clamp(Number(c.scientificValidity) || 0, 0, 5) : 0;
  const hasSV = c.scientificValidity != null;

  // overallScore: LLM 제공값 우선, 없으면 가중치 기반 재계산
  // scientificValidity 누락 시 4축 가중치(구버전), 존재 시 5축 가중치(신버전)
  const fallbackScore = hasSV
    ? (sp * 25 + co * 15 + dp * 25 + gm * 10 + sv * 25) / 5
    : (sp * 30 + co * 20 + dp * 30 + gm * 20) / 5;
  // overallScore vs 계산값 불일치 감지 (15점 이상 차이 = LLM 환각 의심)
  const llmOverall = Number(c.overallScore);
  if (llmOverall > 0 && Math.abs(llmOverall - fallbackScore) > 15) {
    console.warn("[ContentQuality] overallScore 불일치 (LLM vs 계산):", {
      llm: llmOverall,
      calculated: Math.round(fallbackScore),
      diff: Math.round(llmOverall - fallbackScore),
    });
  }
  const overall = llmOverall > 0 ? clamp(llmOverall, 0, 100) : Math.round(fallbackScore);

  return {
    specificity: sp,
    coherence: co,
    depth: dp,
    grammar: gm,
    scientificValidity: sv,
    overallScore: overall,
    issues: Array.isArray(c.issues) ? c.issues.filter((i: unknown) => typeof i === "string") : [],
    feedback: typeof c.feedback === "string" ? c.feedback : "",
  };
}

/**
 * 파싱된 JSON 객체를 HighlightAnalysisResult로 검증/변환
 * parseHighlightResponse와 parseBatchHighlightResponse 양쪽에서 재사용
 */
export function validateHighlightResult(parsed: Record<string, unknown>): HighlightAnalysisResult {
  if (!parsed || typeof parsed !== "object") return EMPTY_RESULT;
  const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
  const rawGrades = Array.isArray(parsed.competencyGrades) ? parsed.competencyGrades : [];

  const sections: AnalyzedSection[] = [];
  for (const s of rawSections) {
    if (!s || typeof s !== "object") continue;
    const sectionType = VALID_SECTIONS.has(s.sectionType) ? s.sectionType : "전체";
    const tags: HighlightTag[] = [];

    for (const t of s.tags ?? []) {
      if (!VALID_ITEMS.has(t.competencyItem)) continue;
      if (!VALID_EVALS.has(t.evaluation)) continue;
      if (!t.highlight || typeof t.highlight !== "string") continue;

      tags.push({
        competencyItem: t.competencyItem as CompetencyItemCode,
        evaluation: t.evaluation,
        highlight: t.highlight,
        reasoning: String(t.reasoning ?? ""),
      });
    }

    if (tags.length > 0) {
      sections.push({
        sectionType: sectionType as AnalyzedSection["sectionType"],
        ...(typeof s.sectionText === "string" && s.sectionText.length > 0 ? { sectionText: s.sectionText } : {}),
        tags,
        needsReview: s.needsReview === true,
      });
    }
  }

  const competencyGrades = rawGrades
    .filter((g: unknown): g is { item: string; grade: string; reasoning?: string; rubricScores?: unknown[] } =>
      !!g && typeof g === "object" && "item" in g && "grade" in g &&
      VALID_ITEMS.has((g as { item: string }).item) && VALID_GRADES.has((g as { grade: string }).grade),
    )
    .map((g: { item: string; grade: string; reasoning?: string; rubricScores?: unknown[] }) => {
      const rubricScores = Array.isArray(g.rubricScores)
        ? g.rubricScores
            .filter((rs): rs is { questionIndex: number; grade: string; reasoning?: string } =>
              !!rs && typeof rs === "object" &&
              "questionIndex" in rs && typeof (rs as Record<string, unknown>).questionIndex === "number" &&
              "grade" in rs && VALID_GRADES.has((rs as Record<string, unknown>).grade as string),
            )
            .map((rs) => ({
              questionIndex: rs.questionIndex,
              grade: rs.grade as CompetencyGrade,
              reasoning: String(rs.reasoning ?? ""),
            }))
        : undefined;

      return {
        item: g.item as CompetencyItemCode,
        grade: g.grade as CompetencyGrade,
        reasoning: String(g.reasoning ?? ""),
        ...(rubricScores && rubricScores.length > 0 ? { rubricScores } : {}),
      };
    });

  const contentQuality = extractContentQuality(parsed);
  return {
    sections,
    competencyGrades,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    ...(contentQuality !== undefined ? { contentQuality } : {}),
  };
}

export function parseHighlightResponse(content: string): HighlightAnalysisResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(content);
  } catch (e) {
    // 파싱 실패를 throw — 호출자가 "역량 근거 없음"과 구분할 수 있도록
    throw new SyntaxError(`AI 응답 JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`);
  }

  return validateHighlightResult(parsed);
}

// ============================================
// 배치 프롬프트 빌더 + 파서
// ============================================

/**
 * 다중 레코드 배치 분석 프롬프트
 * careerContext는 동일 학생이므로 1회만 포함
 */
export function buildBatchHighlightUserPrompt(
  records: BatchHighlightInput["records"],
  careerContext?: HighlightAnalysisInput["careerContext"],
): string {
  let prompt = `## 배치 분석 요청 (${records.length}건)\n\n`;
  prompt += `아래 ${records.length}건의 기록을 **각각 독립적으로** 분석하세요.\n`;
  prompt += `각 기록에 대해 동일한 분석 규칙(역량 체계, 등급 기준, 구간 분류)을 적용합니다.\n\n`;
  prompt += `**응답은 반드시 아래 JSON 형식으로**, results 객체 안에 각 기록의 id를 키로 사용하세요.\n\n`;

  // 공유 careerContext (1회만)
  if (careerContext) {
    const { targetMajor, takenSubjects, relevantScores, gradeTrend } = careerContext;
    prompt += `## 공통 참고 데이터 (전 기록 공유)\n\n`;
    prompt += `- 목표 전공: ${targetMajor}\n`;
    prompt += `- 이수 과목 (${takenSubjects.length}개): ${takenSubjects.join(", ")}\n`;
    if (relevantScores.length > 0) {
      prompt += `- 전공 관련 과목 성적:\n`;
      for (const s of relevantScores) {
        prompt += `  · ${s.subjectName}: ${gradeLabel(s.rankGrade)}\n`;
      }
    }
    if (gradeTrend && gradeTrend.length > 0) {
      const termMap = new Map<string, { sum: number; count: number; subjects: string[] }>();
      for (const s of gradeTrend) {
        const key = `${s.grade}학년 ${s.semester}학기`;
        const entry = termMap.get(key) ?? { sum: 0, count: 0, subjects: [] };
        entry.sum += toGrade9(s.rankGrade);
        entry.count++;
        entry.subjects.push(`${s.subjectName}(${gradeLabel(s.rankGrade)})`);
        termMap.set(key, entry);
      }
      prompt += `\n- **학기별 성적 추이**:\n`;
      for (const [term, data] of termMap) {
        const avg = (data.sum / data.count).toFixed(1);
        prompt += `  · ${term}: 평균 ${avg}등급 (${data.subjects.join(", ")})\n`;
      }
    }
    prompt += `\n위 데이터를 활용하세요:\n`;
    prompt += `- career_course_effort/achievement: 이수율·성적 데이터 기반 평가\n`;
    prompt += `- academic_achievement Q3 (성적 추이): 학기별 평균 등급 변화 패턴 평가\n`;
    prompt += `- academic_achievement Q0~Q2: 텍스트 + 성적 데이터 함께 참고\n\n`;
  }

  // 각 레코드
  for (const rec of records) {
    prompt += `---\n\n### [RECORD] id=${rec.id}\n\n`;
    prompt += `- 기록 유형: ${TYPE_LABEL[rec.recordType] ?? rec.recordType}\n`;
    if (rec.subjectName) prompt += `- 과목: ${rec.subjectName}\n`;
    if (rec.grade) prompt += `- 학년: ${rec.grade}학년\n`;
    if (careerContext?.targetMajor) prompt += `- 목표 전공: ${careerContext.targetMajor}\n`;
    prompt += `\n#### 텍스트 원문\n\n${rec.content}\n\n`;
    prompt += `위 텍스트의 핵심 구절을 빠짐없이 분석하여 JSON으로 응답하세요. **등급 인플레이션에 주의하세요.**\n`;

    if ((rec.recordType === "setek" || rec.recordType === "personal_setek") && rec.content.length >= 100) {
      prompt += `\n이 텍스트는 교과 세특이므로 3구간(학업태도/학업수행능력/탐구활동)으로 분리하여 각 구간의 원문을 sectionText에 포함하세요.\n`;
    }
    prompt += `\n`;
  }

  // 응답 형식 지시
  prompt += `---\n\n## 응답 JSON 형식\n\n`;
  prompt += `\`\`\`json\n{\n  "results": {\n`;
  prompt += `    "<record_id>": {\n`;
  prompt += `      "sections": [...],\n`;
  prompt += `      "competencyGrades": [...],\n`;
  prompt += `      "summary": "...",\n`;
  prompt += `      "contentQuality": { "specificity": 0-5, "coherence": 0-5, "depth": 0-5, "grammar": 0-5, "overallScore": 0-100, "issues": [...], "feedback": "..." }\n`;
  prompt += `    }\n`;
  prompt += `  }\n}\n\`\`\`\n\n`;
  prompt += `각 record_id의 값은 단건 분석과 동일한 구조(sections, competencyGrades, summary, contentQuality)입니다.\n`;
  prompt += `**모든 ${records.length}건의 기록을 빠짐없이 분석하세요.**`;

  return prompt;
}

/**
 * 배치 응답 파서: results 객체에서 개별 결과 추출 + 검증
 * 누락/파싱실패 레코드는 failedIds에 포함
 */
export function parseBatchHighlightResponse(
  content: string,
  expectedIds: string[],
): { succeeded: Map<string, HighlightAnalysisResult>; failedIds: string[] } {
  const succeeded = new Map<string, HighlightAnalysisResult>();
  const failedIds: string[] = [];

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(content);
  } catch {
    return { succeeded, failedIds: [...expectedIds] };
  }

  // results 래퍼 또는 flat 구조 모두 허용
  const resultsObj = (
    parsed.results && typeof parsed.results === "object" ? parsed.results : parsed
  ) as Record<string, unknown>;

  for (const id of expectedIds) {
    const entry = resultsObj[id];
    if (!entry || typeof entry !== "object") {
      failedIds.push(id);
      continue;
    }

    try {
      const result = validateHighlightResult(entry as Record<string, unknown>);
      if (result.sections.length === 0 && result.competencyGrades.length === 0) {
        // 근거 없음 — 성공으로 처리하되 빈 결과
        succeeded.set(id, { sections: [], competencyGrades: [], summary: "해당 텍스트에서 명확한 역량 근거를 찾지 못했습니다." });
      } else {
        succeeded.set(id, result);
      }
    } catch {
      failedIds.push(id);
    }
  }

  return { succeeded, failedIds };
}
