// ============================================
// Phase 1 (Level 4): Step C — 텍스트 품질 평가
// 3-Step 분해의 세 번째 단계: 5축 품질 + 8단계 흐름 + 실패 패턴 감지
// ============================================

import {
  formatFailPatternsForPrompt,
  formatSetekFlowEvaluation,
  CAREER_SUBJECT_MIN_STAGES,
  QUALITY_SCORE_FORMULA,
} from "@/lib/domains/student-record/evaluation-criteria/defaults";
import type { HighlightAnalysisInput, StepATaggingResult, StepCQualityResult, ContentQualityScore } from "../types";
import { extractJson } from "../extractJson";
import { logActionWarn } from "@/lib/logging/actionLogger";
import { grade5To9 } from "@/lib/domains/student-record/grade-normalizer";

const LOG_CTX = { domain: "record-analysis", action: "stepC-quality" };

/** rankGrade 표시 라벨 */
function gradeLabel(rg: number | string): string {
  if (typeof rg === "string") return `${rg}(≈${grade5To9(rg)}등급)`;
  return `${rg}등급`;
}

export const STEP_C_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 생기부 텍스트의 **작성 품질**을 평가합니다.

## 좋은 세특의 8단계 흐름 (평가 기준)

아래 흐름이 얼마나 충족되는지를 specificity/coherence/depth/scientificValidity 평가에 반영하세요:
${formatSetekFlowEvaluation()}

## 합격률 낮은 세특 패턴 감지 (issues에 반영)

아래 패턴이 발견되면 issues 배열에 해당 코드를 포함하세요:
${formatFailPatternsForPrompt()}

## 내신-세특 교차 검증 (필수)

성적 데이터가 제공된 경우, **세특 서술과 실제 성적의 정합성을 반드시 검증**하세요:
- "우수한 학업 성취"라는 서술이 있는데 해당 교과 내신이 3등급 이하 → issues에 "내신 대비 과장 표현" 추가
- 내신이 낮은데 세특에서 대학원급 심화 → P4_내신탐구불일치 (critical)
- 내신이 높지 않아도 세특에서 성실한 탐구 → 감점하지 않음

## 교사 기재 스타일 관용 원칙

학생부는 **학교 선생님**이 작성합니다:
- "~임을 설명함"으로 끝나는 탐구 → **무조건 결론 미완이 아님**
- issues에 기재할 때: "결론_미기술_면접확인필요" (결론 부재가 아님)
- 평가 시에는 관용적 해석 적용

## 진로교과 세특 가중 평가

진로(계열) 관련 교과의 세특인 경우 (목표 전공이 제공된 경우):
- **depth 기대치 상향**: 진로교과에서는 depth 3점이 비진로교과의 4점에 해당. 진로교과인데 depth ≤ 2이면 issues에 "진로교과_탐구부족" 추가
- **8단계 흐름 분석 필수**: 진로교과 세특은 최소 ${CAREER_SUBJECT_MIN_STAGES.map((s) => `${"①②③④⑤⑥⑦⑧"[s - 1]}`).join("")} 단계 충족 여부를 점검. 단, ⑤결론과 ⑧오류→재탐구는 **+@ 가산 요소**이며, 없다고 감점하지 않음
- 비진로교과(국어/체육/음악 등)에서는 교과 역량 중심 평가가 정상이며 진로 연결 없어도 감점하지 않음

## 5축 점수 기준

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
    - 고2: 1학년 중 관심 주제를 선별하여 발전/심화학습
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
  - **인문·사회계**: 문제정의→질문설정→연구설계→자료분석→결론과 제언의 논리적 전개

- **overallScore** (0-100): 종합 = ${QUALITY_SCORE_FORMULA}
- **issues**: 발견된 품질 문제 목록. 패턴 코드(P1~F16) + 자유 기술 혼용 가능
- **feedback**: 개선을 위한 1-2문장 피드백

## JSON 출력 형식

\`\`\`json
{
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

export function buildStepCUserPrompt(
  input: HighlightAnalysisInput,
  stepA: StepATaggingResult,
): string {
  let prompt = `## 평가 대상\n\n`;
  prompt += `- 기록 유형: ${TYPE_LABEL[input.recordType] ?? input.recordType}\n`;
  if (input.subjectName) prompt += `- 과목: ${input.subjectName}\n`;
  if (input.grade) prompt += `- 학년: ${input.grade}학년\n`;
  if (input.careerContext?.targetMajor) prompt += `- 목표 전공: ${input.careerContext.targetMajor}\n`;
  prompt += `\n## 텍스트 원문\n\n${input.content}\n\n`;

  // Step A 구간 경계 정보 (coherence 평가에 참고)
  if (stepA.sections.length > 0) {
    prompt += `## Step A 구간 분류 결과\n\n`;
    for (const section of stepA.sections) {
      const tagCount = section.tags.length;
      prompt += `- **${section.sectionType}**: ${tagCount}개 태그 발견`;
      if (section.needsReview) prompt += ` (검토 필요)`;
      prompt += `\n`;
    }
    prompt += `\n`;
  }

  prompt += `위 텍스트의 작성 품질을 5축 기준으로 평가하고 JSON으로 응답하세요.`;

  // Layer 0: 프로필 카드 (학년별 성장 구조 평가용)
  if (input.profileCard) {
    prompt += `\n\n${input.profileCard}`;
  }

  // 성적 데이터 (교차 검증용)
  if (input.careerContext) {
    const { targetMajor, relevantScores } = input.careerContext;
    prompt += `\n\n## 참고 데이터\n`;
    prompt += `- 목표 전공: ${targetMajor}\n`;
    if (relevantScores.length > 0) {
      prompt += `- 전공 관련 과목 성적:\n`;
      for (const s of relevantScores) {
        prompt += `  · ${s.subjectName}: ${gradeLabel(s.rankGrade)}\n`;
      }
    }
    prompt += `\n위 성적과 세특 서술의 정합성을 검증하세요.`;
  }

  return prompt;
}

// ============================================
// 응답 파서
// ============================================

/** 숫자 범위 클램프 헬퍼 */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const EMPTY_RESULT: StepCQualityResult = {
  contentQuality: {
    specificity: 0,
    coherence: 0,
    depth: 0,
    grammar: 0,
    scientificValidity: 0,
    overallScore: 0,
    issues: [],
    feedback: "",
  },
};

export function parseStepCResponse(content: string): StepCQualityResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(content);
  } catch (e) {
    throw new SyntaxError(`Step C JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== "object") return EMPTY_RESULT;

  // contentQuality가 직접 반환되거나 래핑된 경우 모두 허용
  const cq = (parsed.contentQuality && typeof parsed.contentQuality === "object"
    ? parsed.contentQuality
    : parsed) as Record<string, unknown>;

  // 축 점수가 하나도 없으면 실패
  if (cq.specificity == null && cq.coherence == null && cq.depth == null) {
    return EMPTY_RESULT;
  }

  // 범위 초과 감지 (clamp 전)
  const rawAxes: Record<string, number> = {
    specificity: Number(cq.specificity) || 0,
    coherence: Number(cq.coherence) || 0,
    depth: Number(cq.depth) || 0,
    grammar: Number(cq.grammar) || 0,
  };
  if (cq.scientificValidity != null) rawAxes.scientificValidity = Number(cq.scientificValidity) || 0;
  if (Object.values(rawAxes).some((v) => v < 0 || v > 5)) {
    logActionWarn(LOG_CTX, `[StepC] 축 점수 범위 초과 (유효범위 0-5): ${JSON.stringify(rawAxes)}`);
  }

  const sp = clamp(Number(cq.specificity) || 0, 0, 5);
  const co = clamp(Number(cq.coherence) || 0, 0, 5);
  const dp = clamp(Number(cq.depth) || 0, 0, 5);
  const gm = clamp(Number(cq.grammar) || 0, 0, 5);
  const sv = cq.scientificValidity != null ? clamp(Number(cq.scientificValidity) || 0, 0, 5) : 0;
  const hasSV = cq.scientificValidity != null;

  // overallScore 계산
  const fallbackScore = hasSV
    ? (sp * 25 + co * 15 + dp * 25 + gm * 10 + sv * 25) / 5
    : (sp * 30 + co * 20 + dp * 30 + gm * 20) / 5;
  const llmOverall = Number(cq.overallScore);
  if (llmOverall > 0 && Math.abs(llmOverall - fallbackScore) > 15) {
    logActionWarn(
      LOG_CTX,
      `[StepC] overallScore 불일치 (LLM vs 계산): llm=${llmOverall}, calculated=${Math.round(fallbackScore)}, diff=${Math.round(llmOverall - fallbackScore)}`,
    );
  }
  const overall = llmOverall > 0 ? clamp(llmOverall, 0, 100) : Math.round(fallbackScore);

  return {
    contentQuality: {
      specificity: sp,
      coherence: co,
      depth: dp,
      grammar: gm,
      scientificValidity: sv,
      overallScore: overall,
      issues: Array.isArray(cq.issues) ? cq.issues.filter((i: unknown) => typeof i === "string") : [],
      feedback: typeof cq.feedback === "string" ? cq.feedback : "",
    },
  };
}
