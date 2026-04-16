// ============================================
// Past Diagnosis 프롬프트 — 현상 진단 (scope='past')
//
// 4축×3층 통합 아키텍처 A층(Past Analytics). 2026-04-16 D.
// Final Diagnosis(전체 3년 종합)와 별도로, NEIS 학년 범위 내에서
// "현재까지의 강점/약점/보완 필요"를 진단한다.
//
// 원칙:
//   - 입력: NEIS 역량 점수 + 활동 태그 + Past Storyline.
//   - 금지: 3학년 가안/Blueprint/exemplar 참조. 미래 설계 평가 금지.
//   - 톤: 현재 상태 평가만. "~할 것이 예상된다"는 금지.
// ============================================

import { extractJson } from "../extractJson";
import {
  COMPETENCY_ITEMS,
  COMPETENCY_AREA_LABELS,
  COMPETENCY_RUBRIC_QUESTIONS,
} from "@/lib/domains/student-record/constants";
import type {
  CompetencyScore,
  ActivityTag,
  CompetencyItemCode,
} from "@/lib/domains/student-record/types";

export interface PastDiagnosisImprovement {
  priority: "높음" | "중간" | "낮음";
  area: string;
  gap: string;
  action: string;
  outcome: string;
}

export interface PastDiagnosisResult {
  overallGrade: string;
  recordDirection: string;
  directionStrength: "strong" | "moderate" | "weak";
  directionReasoning: string;
  strengths: string[];
  weaknesses: string[];
  improvements: PastDiagnosisImprovement[];
  /** 과거 기록에 대한 총평 (400자 이내) */
  summary: string;
}

export const PAST_DIAGNOSIS_SYSTEM_PROMPT = `당신은 대입 컨설팅 전문가입니다. 학생의 **NEIS 확정 기록까지의 현상**을 진단합니다. 아직 쓰이지 않은 미래 학년·Blueprint·수강 계획·exemplar는 주어지지 않습니다.

## 진단 항목

1. overallGrade: **현재 NEIS 기록까지의** 종합 등급 (A+/A-/B+/B/B-/C)
2. recordDirection: 지금까지 드러난 기록 방향 (50자 이내)
3. directionStrength: strong/moderate/weak (지금까지의 기록만 기준)
4. directionReasoning: 방향 강도 판단 근거 (100자 이내)
5. strengths: 현재 드러난 강점 **3~5개**
6. weaknesses: 현재 드러난 약점 **2~4개**
7. improvements: "즉시 행동" 관점 개선 과제 **2~3개** (장기 전략 아님)
8. summary: 현재까지의 기록 총평 (400자 이내)

## 엄격한 원칙 (위반 시 출력 폐기)

1. **"3학년 가안", "Blueprint", "설계 청사진", "미래", "앞으로", "예정"** 등 미래 투사 어휘 사용 금지. 오직 **지금까지의 NEIS 기록**만 평가.
2. **exemplar(유사 진로 우수 사례)** 참조·비교 금지.
3. **"이수율 0%"**, "전공 관련 탐구 전무" 같은 결여 판정은, NEIS 학년 범위 안에서만 유효. 아직 오지 않은 학년을 근거로 결여라고 판정 금지.
4. strategyNotes 필드 금지 (Past Strategy가 별도 수행).
5. recommendedMajors 필드 금지 (Final Diagnosis가 수행).
6. inferredEdges 필드 금지 (Final 전용).

## 출력 형식 (JSON만)

\`\`\`json
{
  "overallGrade": "B+",
  "recordDirection": "의학·생명 탐구 중심",
  "directionStrength": "moderate",
  "directionReasoning": "1~2학년 생명·화학 세특에서 탐구 방향 일관",
  "strengths": [
    "[학업역량] 탐구력 — A-. 근거: 생명과학 세특의 문제 제기→실험→결론 구조 완결. 증거: 긍정 태그 18건"
  ],
  "weaknesses": [
    "[진로역량] 전공 교과 이수 품질 — B. 근거: 화학 세특 내용이 교과서 수준 요약에 머물러 심화 부족"
  ],
  "improvements": [
    {"priority": "높음", "area": "setek", "gap": "화학 세특 심화 부족", "action": "남은 학기 화학 탐구를 최신 논문 1편 기반 가설 검증 보고서로 확장", "outcome": "탐구력 B→A- 진입 가능"}
  ],
  "summary": "1~2학년 생명·화학 중심 탐구 축이 안정적으로 형성되었으나 화학 세특의 심화가 남은 과제다. ..."
}
\`\`\`

## 강점/약점 작성 규칙

- strengths: "[역량영역] 항목명 — 등급. 근거: ... 증거: 태그 N건" 형식.
- weaknesses: "[역량영역] 항목명 — 등급/갭 설명. 개선: 방향" 형식. "기록이 아직 없다"는 약점 아님.

## 합격률 낮은 패턴 감지 (NEIS 범위 내에서만)
- P1 나열식 / P3 키워드만 / P4 내신↔탐구불일치 / F16 진로과잉도배 등 패턴이 **실제 NEIS 기록**에서 발견되면 약점 또는 summary에 반영.
- 단, 기록이 부족해서 패턴을 측정할 수 없다면 약점에 포함 금지.`;

export function buildPastDiagnosisUserPrompt(params: {
  neisGrades: number[];
  competencyScores: CompetencyScore[];
  activityTags: ActivityTag[];
  pastStorylineSection?: string;
  qualityPatternSection?: string;
  studentInfo?: { targetMajor?: string; schoolName?: string };
}): string {
  const {
    neisGrades,
    competencyScores,
    activityTags,
    pastStorylineSection,
    qualityPatternSection,
    studentInfo,
  } = params;

  const gradesLabel = neisGrades.map((g) => `${g}학년`).join(", ");

  // 역량 등급 요약
  const gradesLines = COMPETENCY_ITEMS.map((item) => {
    const manual = competencyScores.find(
      (s) => s.competency_item === item.code && s.source === "manual",
    );
    const ai = competencyScores.find(
      (s) => s.competency_item === item.code && s.source === "ai",
    );
    const score = manual ?? ai;
    const src = manual ? "(컨설턴트)" : ai ? "(AI)" : "";
    let line = `- ${COMPETENCY_AREA_LABELS[item.area]} > ${item.label}: ${score?.grade_value ?? "미평가"} ${src}`;

    const questions =
      COMPETENCY_RUBRIC_QUESTIONS[item.code as CompetencyItemCode] ?? [];
    const rubrics = Array.isArray(score?.rubric_scores)
      ? (score.rubric_scores as Array<{
          questionIndex: number;
          grade: string;
          reasoning: string;
        }>)
      : [];
    const rubricMap = new Map(rubrics.map((r) => [r.questionIndex, r]));
    for (let qi = 0; qi < questions.length; qi++) {
      const r = rubricMap.get(qi);
      if (r) {
        line += `\n    Q${qi}. ${questions[qi]} → ${r.grade} ("${r.reasoning.slice(0, 120)}")`;
      }
    }
    return line;
  }).join("\n");

  // 태그 요약
  const byItem = new Map<
    string,
    { positive: number; negative: number; needs_review: number; total: number }
  >();
  for (const t of activityTags) {
    const entry = byItem.get(t.competency_item) ?? {
      positive: 0,
      negative: 0,
      needs_review: 0,
      total: 0,
    };
    if (t.evaluation === "positive") entry.positive++;
    else if (t.evaluation === "negative") entry.negative++;
    else entry.needs_review++;
    entry.total++;
    byItem.set(t.competency_item, entry);
  }
  const tagLines = [...byItem.entries()].map(([code, s]) => {
    const label =
      COMPETENCY_ITEMS.find((i) => i.code === code)?.label ?? code;
    return `  - ${label}: 긍정 ${s.positive}, 부정 ${s.negative}, 확인필요 ${s.needs_review} (총 ${s.total})`;
  });

  return `## 학생 정보
- 확정된 NEIS 학년: **${gradesLabel}** (아직 오지 않은 학년은 평가 금지)
${studentInfo?.targetMajor ? `- 희망 전공: ${studentInfo.targetMajor}` : "- 희망 전공: 미정"}
${studentInfo?.schoolName ? `- 학교: ${studentInfo.schoolName}` : ""}

## 역량 등급 + 루브릭 질문별 상세
${gradesLines}

## 활동 태그 (총 ${activityTags.length}건)
${tagLines.join("\n")}
${pastStorylineSection ? `\n## 과거 스토리라인 (A1 산출물)\n${pastStorylineSection}\n` : ""}${qualityPatternSection ? `\n${qualityPatternSection}\n` : ""}

위 데이터(**NEIS 범위 내에서만**)를 바탕으로 과거 진단을 JSON으로 작성하세요. 아직 쓰이지 않은 학년·Blueprint·수강 계획은 주어지지 않았으며 참조 금지입니다.`;
}

const VALID_STRENGTHS = new Set(["strong", "moderate", "weak"]);
const VALID_PRIORITIES = new Set(["높음", "중간", "낮음"]);

export function parsePastDiagnosisResponse(content: string): PastDiagnosisResult {
  const parsed = extractJson(content);

  const strength = VALID_STRENGTHS.has(parsed.directionStrength)
    ? (parsed.directionStrength as "strong" | "moderate" | "weak")
    : "moderate";

  const improvements: PastDiagnosisImprovement[] = Array.isArray(
    parsed.improvements,
  )
    ? parsed.improvements
        .filter((i: Record<string, unknown>) => typeof i === "object" && i !== null)
        .map((i: Record<string, unknown>) => ({
          priority: VALID_PRIORITIES.has(i.priority as string)
            ? (i.priority as "높음" | "중간" | "낮음")
            : "중간",
          area: String(i.area ?? ""),
          gap: String(i.gap ?? ""),
          action: String(i.action ?? ""),
          outcome: String(i.outcome ?? ""),
        }))
    : [];

  return {
    overallGrade: String(parsed.overallGrade ?? "B"),
    recordDirection: String(parsed.recordDirection ?? ""),
    directionStrength: strength,
    directionReasoning: String(parsed.directionReasoning ?? ""),
    strengths: Array.isArray(parsed.strengths)
      ? (parsed.strengths as unknown[]).map(String)
      : [],
    weaknesses: Array.isArray(parsed.weaknesses)
      ? (parsed.weaknesses as unknown[]).map(String)
      : [],
    improvements,
    summary: String(parsed.summary ?? ""),
  };
}
