// ============================================
// Phase 1 (Level 4): Step B — 루브릭 기반 등급 채점
// 3-Step 분해의 두 번째 단계: Step A 태그 기반 bottom-up 등급 산출
// ============================================

import { COMPETENCY_ITEMS, COMPETENCY_RUBRIC_QUESTIONS } from "@/lib/domains/student-record/constants";
import type { CompetencyItemCode, CompetencyGrade } from "@/lib/domains/student-record/types";
import type { HighlightAnalysisInput, StepATaggingResult, StepBRubricResult } from "../types";
import { extractJson } from "../extractJson";
import { grade5To9 } from "@/lib/domains/student-record/grade-normalizer";

/** rankGrade 표시 라벨 */
function gradeLabel(rg: number | string): string {
  if (typeof rg === "string") return `${rg}(≈${grade5To9(rg)}등급)`;
  return `${rg}등급`;
}

/** rankGrade → 9등급 숫자 */
function toGrade9(rg: number | string): number {
  if (typeof rg === "string") return grade5To9(rg);
  return rg;
}

// 역량 체계 + 루브릭 질문 포함
const COMPETENCY_SCHEMA_FULL = COMPETENCY_ITEMS.map((item) => {
  const questions = COMPETENCY_RUBRIC_QUESTIONS[item.code];
  return `- ${item.code} (${item.label}): ${item.evalTarget}\n  루브릭: ${questions.join(" / ")}`;
}).join("\n");

export const STEP_B_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 이미 추출된 역량 태그를 기반으로 **루브릭 질문별 Bottom-Up 등급**을 산출합니다.

## 역량 체계 (3대 역량 × 10개 항목 + 루브릭 질문)

${COMPETENCY_SCHEMA_FULL}

## 등급 산출 규칙

1. **Bottom-Up 평가**: 아래 순서로 평가합니다:
   a) 태그가 1개라도 발견된 역량 항목의 루브릭 질문을 **개별 평가** (questionIndex 0-based)
   b) 각 질문에 등급(A+/A-/B+/B/B-/C) + 한 문장 근거. 근거 없는 질문은 생략
   c) 항목 종합 등급 = 질문 등급의 평균 반올림. **등급을 생략하지 마세요**
   d) 등급 기준: A+(구체적 성과+심화+독창) / A-(우수하나 일부 부족) / B+(평균 이상, 차별점 부족) / B(기본, "참여함" 수준) / B-(피상적) / C(근거 없음)

2. **등급 인플레이션 방지**: 구체적 성과 없이 "참여함/관심을 보임" 수준은 B~B+ 범위입니다.

3. **태그가 없는 역량 항목은 채점하지 마세요.** 제공된 태그 목록에 있는 항목만 채점합니다.

4. **career_course_effort/achievement**: 이수율·성적 데이터가 제공되면 이를 기반으로 채점합니다.

### 내신-세특 교차 검증

성적 데이터가 제공된 경우, **세특 서술과 실제 성적의 정합성을 반드시 검증**하세요:
- "우수한 학업 성취"라는 서술이 있는데 해당 교과 내신이 3등급 이하 → 등급 하향 조정
- 내신이 낮은데 세특에서 대학원급 심화 → 등급 하향 + reasoning에 불일치 명시
- 내신이 높지 않아도 세특에서 성실한 탐구 → 학업태도로는 인정 가능

### 진로교과 세특 가중 평가

진로(계열) 관련 교과의 세특인 경우 (목표 전공이 제공된 경우):
- **depth 기대치 상향**: 진로교과에서는 기대 수준이 높음. 동일 수준의 탐구라도 비진로교과보다 엄격하게 평가
- 비진로교과에서는 교과 역량 중심 평가가 정상이며 진로 연결 없어도 감점하지 않음

## JSON 출력 형식

\`\`\`json
{
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
// Step A 태그를 역량 항목별로 그룹화 (Step B 입력용)
// ============================================

const EVAL_SYMBOL: Record<string, string> = { positive: "P", negative: "N", needs_review: "?" };

export function serializeStepAForRubric(stepA: StepATaggingResult): string {
  // 역량 항목별로 태그 그룹화
  const itemTags = new Map<string, Array<{ eval: string; highlight: string; reasoning: string; confidence: number }>>();
  for (const section of stepA.sections) {
    for (const tag of section.tags) {
      if (!itemTags.has(tag.competencyItem)) itemTags.set(tag.competencyItem, []);
      itemTags.get(tag.competencyItem)!.push({
        eval: tag.evaluation,
        highlight: tag.highlight,
        reasoning: tag.reasoning,
        confidence: tag.confidence,
      });
    }
  }

  let result = `## Step A 분석 결과 (역량 태그)\n\n`;
  for (const item of COMPETENCY_ITEMS) {
    const tags = itemTags.get(item.code);
    if (!tags || tags.length === 0) continue;
    result += `### ${item.code} (${item.label}) — ${tags.length}개 태그\n`;
    for (const tag of tags) {
      const sym = EVAL_SYMBOL[tag.eval] ?? "?";
      result += `[${sym}] "${tag.highlight}" (conf: ${tag.confidence.toFixed(2)})\n`;
      result += `  → ${tag.reasoning}\n`;
    }
    result += `\n`;
  }
  return result;
}

// ============================================
// 사용자 프롬프트 빌더
// ============================================

export function buildStepBUserPrompt(
  input: HighlightAnalysisInput,
  stepA: StepATaggingResult,
): string {
  let prompt = `## 채점 대상\n\n`;
  prompt += `- 기록 유형: ${input.recordType === "setek" ? "교과 세특" : input.recordType === "changche" ? "창체" : input.recordType === "haengteuk" ? "행특" : input.recordType}\n`;
  if (input.subjectName) prompt += `- 과목: ${input.subjectName}\n`;
  if (input.grade) prompt += `- 학년: ${input.grade}학년\n`;
  if (input.careerContext?.targetMajor) prompt += `- 목표 전공: ${input.careerContext.targetMajor}\n`;
  prompt += `\n## 텍스트 원문\n\n${input.content}\n\n`;

  // Step A 태그 (역량 항목별 그룹화)
  prompt += serializeStepAForRubric(stepA);

  prompt += `\n위 태그가 발견된 역량 항목에 대해서만 루브릭 질문별 등급을 매기세요. **태그가 없는 역량 항목은 채점하지 마세요.** 등급 인플레이션에 주의하세요.`;

  // 진로 역량 + 성적 데이터
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
    prompt += `- academic_achievement Q0~Q2: 텍스트 + 성적 데이터 함께 참고\n`;
  }

  return prompt;
}

// ============================================
// 응답 파서
// ============================================

const VALID_ITEMS = new Set<string>(COMPETENCY_ITEMS.map((i) => i.code));
const VALID_GRADES = new Set(["A+", "A-", "B+", "B", "B-", "C"]);

const EMPTY_RESULT: StepBRubricResult = { competencyGrades: [], summary: "" };

export function parseStepBResponse(content: string): StepBRubricResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJson(content);
  } catch (e) {
    throw new SyntaxError(`Step B JSON 파싱 실패: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!parsed || typeof parsed !== "object") return EMPTY_RESULT;
  const rawGrades = Array.isArray(parsed.competencyGrades) ? parsed.competencyGrades : [];

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
    competencyGrades,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}
