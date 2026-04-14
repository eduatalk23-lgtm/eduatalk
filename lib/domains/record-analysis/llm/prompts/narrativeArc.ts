// ============================================
// Phase 2 Layer 3: Narrative Arc 8단계 서사 태깅 프롬프트
// setek-evaluation-framework Phase B (8단계 기준) 구조화
// ============================================

import type {
  NarrativeArcExtractionInput,
  NarrativeArcExtractionResult,
  NarrativeArcStage,
  NarrativeArcStageResult,
} from "../types";
import { extractJson } from "../extractJson";

const STAGE_KEYS: NarrativeArcStage[] = [
  "curiosity",
  "topicSelection",
  "inquiryContent",
  "references",
  "conclusion",
  "teacherObservation",
  "growthNarrative",
  "reinquiry",
];

const TYPE_LABEL: Record<NarrativeArcExtractionInput["recordType"], string> = {
  setek: "교과 세특",
  personal_setek: "개인 세특(학교자율과정)",
  changche: "창의적 체험활동",
  haengteuk: "행동특성 및 종합의견",
};

export const NARRATIVE_ARC_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가로, 생기부 레코드 1건을 읽고 **8단계 서사 흐름**이 각각 존재하는지 판정합니다.

## 8단계 정의 및 판정 기준

**①호기심 (curiosity)**
- 탐구를 시작한 동기·질문·의문이 **명시**되어야 present=true
- 근거 문구 예: "~에 의문을 가짐", "~가 궁금하여", "~에 흥미를 느껴", "왜 ~인지 탐구"
- 주의: "관심을 갖고" 같은 상투어만으로는 불충분. 구체적 대상/질문이 있어야 함

**②주제선정 (topicSelection)**
- **구체적 탐구 주제**가 명시되어야 present=true
- 근거 문구 예: "~을 주제로 선정", "~라는 문제를 설정", "~에 대해 탐구하기로"
- 주의: 교과 단원명만 언급된 경우는 false (선정 과정 없음)

**③탐구내용 (inquiryContent)**
- 탐구 **과정·방법·활동**이 구체적으로 서술되어야 present=true
- 근거 문구 예: "~자료를 조사", "~실험을 설계", "~를 측정하여 비교", "~를 조사·분석"
- 주의: "탐구함" 같은 동사만으로는 불충분. 방법/자료/단계가 드러나야 함

**④참고문헌 (references)**
- **자료·문헌·출처**가 명시되어야 present=true
- 근거 문구 예: 책 제목, 논문 언급, "통계청 자료", "~연구진의 ~에 따르면", "~학술지", URL
- 주의: "인터넷 검색" 같은 일반 표현은 불충분

**⑤결론 (conclusion)**
- 탐구 **결과·결론·발견**이 제시되어야 present=true
- 근거 문구 예: "~임을 확인", "~라는 결론", "~를 알게 됨", "~를 증명", "~의 차이를 발견"
- 주의: 과정 서술로 끝나고 결론이 없으면 false

**⑥교사관찰 (teacherObservation)**
- 교사의 **직접 관찰·평가**가 포함되어야 present=true
- 근거 문구 예: "~한 모습이 인상적", "~한 태도를 보임", "~한 점이 돋보임", "뛰어난 ~을 보여줌"
- 주의: 학생 행위 서술("발표함") 만으로는 불충분. 교사의 평가/시선이 있어야 함

**⑦성장서사 (growthNarrative)**
- 탐구를 통한 **학생 성장·변화·의식 전환**이 서술되어야 present=true
- 근거 문구 예: "~를 깨달음", "~에 대한 시각이 넓어짐", "~를 배움", "~역량이 향상됨"
- 주의: 단순 "참여함"은 불충분. 전·후 대비 또는 변화 서술 필요

**⑧재탐구 (reinquiry)**
- 후속 **탐구/심화 의지·계획**이 언급되어야 present=true
- 근거 문구 예: "추후 ~를 살펴보고 싶음", "더 깊이 ~할 계획", "~분야로 확장 탐구하고자"
- 주의: "열심히 하겠다" 같은 일반 다짐은 불충분. 구체적 탐구 방향이 있어야 함

## 레코드 유형별 적용 원칙

- **교과 세특 / 개인 세특**: 8단계 전부 적용. 이상적 세특은 6~8단계 포함.
- **창의적 체험활동**: 6~8단계 중심(체험·성찰·확장). ④참고문헌은 선택적.
- **행동특성 및 종합의견**: ⑥교사관찰 + ⑦성장서사 중심. ③탐구내용·④참고문헌은 대개 false.

## 평가 규칙

1. **원문 우선**: evidence는 **원문 그대로 인용** (100자 이하). 요약하거나 재구성 금지.
2. **보수적 판정**: 애매하면 present=false. 근거 없는 긍정은 지양.
3. **confidence**: 원문 근거 명확 0.9+, 암묵적 단서 0.6~0.8, 약한 단서 0.4~0.6, 불확실 0.4 미만.
4. **present=false일 때 evidence는 빈 문자열** ("").

## JSON 출력 형식 (엄격)

\`\`\`json
{
  "curiosity":           { "present": true,  "confidence": 0.85, "evidence": "원문 인용" },
  "topicSelection":      { "present": true,  "confidence": 0.90, "evidence": "원문 인용" },
  "inquiryContent":      { "present": true,  "confidence": 0.80, "evidence": "원문 인용" },
  "references":          { "present": false, "confidence": 0.90, "evidence": "" },
  "conclusion":          { "present": true,  "confidence": 0.75, "evidence": "원문 인용" },
  "teacherObservation":  { "present": true,  "confidence": 0.85, "evidence": "원문 인용" },
  "growthNarrative":     { "present": false, "confidence": 0.70, "evidence": "" },
  "reinquiry":           { "present": false, "confidence": 0.85, "evidence": "" }
}
\`\`\`

JSON 외 설명 텍스트를 출력하지 마세요.`;

export function buildNarrativeArcUserPrompt(
  input: NarrativeArcExtractionInput,
): string {
  const typeLabel = TYPE_LABEL[input.recordType];
  const subjectLine = input.subjectName ? ` / ${input.subjectName}` : "";
  const majorLine = input.targetMajor ? `- 목표 전공: ${input.targetMajor}\n` : "";

  return `## 분석 대상 레코드

- 유형: ${typeLabel}${subjectLine}
- 학년/학년도: ${input.grade}학년 / ${input.schoolYear}년
${majorLine}
## 원문

${input.content}

---

위 원문에 대해 8단계(curiosity/topicSelection/inquiryContent/references/conclusion/teacherObservation/growthNarrative/reinquiry) 존재 여부를 판정하고 JSON으로만 응답하세요.`;
}

// ============================================
// 응답 파서
// ============================================

function emptyStage(confidence = 0.3): NarrativeArcStageResult {
  return { present: false, confidence, evidence: "" };
}

function parseStage(raw: unknown): NarrativeArcStageResult {
  if (!raw || typeof raw !== "object") return emptyStage();
  const r = raw as Record<string, unknown>;

  const present = typeof r.present === "boolean" ? r.present : false;
  const confidenceNum = typeof r.confidence === "number" ? r.confidence : 0.5;
  const confidence = Math.max(0, Math.min(1, confidenceNum));
  const evidenceRaw = typeof r.evidence === "string" ? r.evidence.trim() : "";
  // present=false 때 evidence 비움. present=true일 때 150자 제한.
  const evidence = present ? evidenceRaw.slice(0, 150) : "";

  return { present, confidence, evidence };
}

export function parseNarrativeArcResponse(
  content: string,
): Omit<NarrativeArcExtractionResult, "elapsedMs" | "modelName"> {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(content);
  } catch (e) {
    throw new SyntaxError(
      `Narrative Arc JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    const empty: NarrativeArcStageResult = emptyStage();
    return {
      curiosity: empty,
      topicSelection: empty,
      inquiryContent: empty,
      references: empty,
      conclusion: empty,
      teacherObservation: empty,
      growthNarrative: empty,
      reinquiry: empty,
      stagesPresentCount: 0,
    };
  }

  const stages = Object.fromEntries(
    STAGE_KEYS.map((k) => [k, parseStage(parsed[k])]),
  ) as Record<NarrativeArcStage, NarrativeArcStageResult>;

  const stagesPresentCount = STAGE_KEYS.reduce(
    (acc, k) => acc + (stages[k].present ? 1 : 0),
    0,
  );

  return { ...stages, stagesPresentCount };
}
