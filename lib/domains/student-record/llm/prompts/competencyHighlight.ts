// ============================================
// 세특 인라인 하이라이트 + 역량 분석 프롬프트
// Phase 6.1 — 원문 구절 인용 기반 역량 태깅
// ============================================

import { COMPETENCY_ITEMS, COMPETENCY_RUBRIC_QUESTIONS } from "../../constants";
import type { HighlightAnalysisInput, HighlightAnalysisResult, AnalyzedSection, HighlightTag, BatchHighlightInput } from "../types";
import type { CompetencyItemCode, CompetencyGrade } from "../../types";
import { extractJson } from "../extractJson";

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
   - career_course_effort/achievement: 이수율·성적 데이터로 별도 산정. 텍스트에서 태깅하지 마세요
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
  "summary": "학업 탐구력이 두드러지며 진로 연결이 우수함"
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
        prompt += `  · ${s.subjectName}: ${s.rankGrade}등급\n`;
      }
    }

    // 학기별 성적 추이 (academic_achievement Q3 "학기별/학년별 성적의 추이" 평가용)
    if (gradeTrend && gradeTrend.length > 0) {
      // 학기별 평균 등급 계산
      const termMap = new Map<string, { sum: number; count: number; subjects: string[] }>();
      for (const s of gradeTrend) {
        const key = `${s.grade}학년 ${s.semester}학기`;
        const entry = termMap.get(key) ?? { sum: 0, count: 0, subjects: [] };
        entry.sum += s.rankGrade;
        entry.count++;
        entry.subjects.push(`${s.subjectName}(${s.rankGrade})`);
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

  return {
    sections,
    competencyGrades,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
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
        prompt += `  · ${s.subjectName}: ${s.rankGrade}등급\n`;
      }
    }
    if (gradeTrend && gradeTrend.length > 0) {
      const termMap = new Map<string, { sum: number; count: number; subjects: string[] }>();
      for (const s of gradeTrend) {
        const key = `${s.grade}학년 ${s.semester}학기`;
        const entry = termMap.get(key) ?? { sum: 0, count: 0, subjects: [] };
        entry.sum += s.rankGrade;
        entry.count++;
        entry.subjects.push(`${s.subjectName}(${s.rankGrade})`);
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
  prompt += `      "summary": "..."\n`;
  prompt += `    }\n`;
  prompt += `  }\n}\n\`\`\`\n\n`;
  prompt += `각 record_id의 값은 단건 분석과 동일한 구조(sections, competencyGrades, summary)입니다.\n`;
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
