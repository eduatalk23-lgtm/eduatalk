// ============================================
// AI 종합 진단 프롬프트 빌딩 로직
// generateDiagnosis.ts에서 추출한 프롬프트 조립 함수들
// ============================================

import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS, COMPETENCY_RUBRIC_QUESTIONS, MAJOR_RECOMMENDED_COURSES } from "../../constants";
import type { CompetencyScore, ActivityTag, CompetencyItemCode } from "../../types";
import {
  formatDiagnosisCareerWeakPatterns,
  formatDiagnosisMacroPatterns,
} from "../../evaluation-criteria/defaults";
import type { DiagnosisEnrichedContext } from "../actions/diagnosis-helpers";

const MAJOR_LIST = Object.keys(MAJOR_RECOMMENDED_COURSES).join(", ");

// TagItemStats 타입 (diagnosis-helpers.ts와 공유)
export type TagItemStats = {
  positive: number;
  negative: number;
  needs_review: number;
  confirmed: number;
  total: number;
  byType: Map<string, number>;
  samples: string[];
};

// ── 역량 등급 + 루브릭 질문별 상세 요약 빌드 ──
export function buildGradesSummary(
  competencyScores: CompetencyScore[],
): { gradesSummary: string; rubricGaps: string[] } {
  const rubricGaps: string[] = [];
  const gradesSummary = COMPETENCY_ITEMS.map((item) => {
    const manualScore = competencyScores.find((s) => s.competency_item === item.code && s.source === "manual");
    const aiScore = competencyScores.find((s) => s.competency_item === item.code && s.source === "ai");
    const score = manualScore ?? aiScore;
    const source = manualScore ? "(컨설턴트)" : aiScore ? "(AI)" : "";

    let line = `- ${COMPETENCY_AREA_LABELS[item.area]} > ${item.label}: ${score?.grade_value ?? "미평가"} ${source}`;

    // 루브릭 질문별 등급 포함
    const questions = COMPETENCY_RUBRIC_QUESTIONS[item.code as CompetencyItemCode] ?? [];
    const rubrics = Array.isArray(score?.rubric_scores) ? score.rubric_scores as Array<{ questionIndex: number; grade: string; reasoning: string }> : [];
    const rubricMap = new Map(rubrics.map((r) => [r.questionIndex, r]));

    if (questions.length > 0) {
      for (let qi = 0; qi < questions.length; qi++) {
        const r = rubricMap.get(qi);
        if (r) {
          line += `\n    Q${qi}. ${questions[qi]} → ${r.grade} ("${r.reasoning.slice(0, 150)}")`;
        } else {
          line += `\n    Q${qi}. ${questions[qi]} → ⚠ 근거없음`;
          rubricGaps.push(`${item.label} Q${qi}: "${questions[qi]}"`);
        }
      }
    }

    return line;
  }).join("\n");

  return { gradesSummary, rubricGaps };
}

// ── 활동 태그 요약 빌드 ──
export function buildTagsByItem(activityTags: ActivityTag[]): Map<string, TagItemStats> {
  const tagsByItem = new Map<string, TagItemStats>();
  for (const t of activityTags) {
    const key = t.competency_item;
    const entry: TagItemStats = tagsByItem.get(key) ?? {
      positive: 0, negative: 0, needs_review: 0, confirmed: 0, total: 0,
      byType: new Map(), samples: [] as string[],
    };
    if (t.evaluation === "positive") entry.positive++;
    else if (t.evaluation === "negative") entry.negative++;
    else entry.needs_review++;
    if (t.status === "confirmed") entry.confirmed++;
    entry.total++;
    entry.byType.set(t.record_type, (entry.byType.get(t.record_type) ?? 0) + 1);
    if (entry.samples.length < 2 && t.evidence_summary) {
      entry.samples.push(t.evidence_summary.replace(/^\[AI\]\s*/, "").split("\n")[0].slice(0, 60));
    }
    tagsByItem.set(key, entry);
  }
  return tagsByItem;
}

export function buildTagsSummary(
  activityTags: ActivityTag[],
  tagsByItem: Map<string, TagItemStats>,
): string {
  return [
    `활동 태그 분석 (총 ${activityTags.length}건):`,
    ...Array.from(tagsByItem.entries()).map(([item, stats]) => {
      const label = COMPETENCY_ITEMS.find((i) => i.code === item)?.label ?? item;
      const parts: string[] = [];
      if (stats.positive > 0) parts.push(`긍정 ${stats.positive}건`);
      if (stats.negative > 0) parts.push(`부정 ${stats.negative}건`);
      if (stats.needs_review > 0) parts.push(`확인필요 ${stats.needs_review}건`);
      const counts = parts.join(", ");
      const confirmInfo = stats.confirmed > 0 ? ` [확정 ${stats.confirmed}/${stats.total}건]` : "";
      const typeBreakdown = [...stats.byType.entries()].map(([type, cnt]) => `${type} ${cnt}`).join(", ");
      const samples = stats.samples.length > 0 ? `\n    예: ${stats.samples.join("; ")}` : "";
      return `  - ${label}: ${counts}${confirmInfo} (${typeBreakdown})${samples}`;
    }),
  ].filter(Boolean).join("\n");
}

// ── 성적 추이 섹션 빌드 ──
export function buildTrendSection(enrichedContext?: DiagnosisEnrichedContext): string {
  if (!enrichedContext?.gradeTrend || enrichedContext.gradeTrend.length === 0) return "";

  const termMap = new Map<string, { sum: number; count: number }>();
  for (const s of enrichedContext.gradeTrend) {
    const key = `${s.grade}학년 ${s.semester}학기`;
    const entry = termMap.get(key) ?? { sum: 0, count: 0 };
    entry.sum += s.rankGrade;
    entry.count++;
    termMap.set(key, entry);
  }
  const terms = [...termMap.entries()].map(([term, data]) => {
    const avg = (data.sum / data.count).toFixed(1);
    return `  · ${term}: 평균 ${avg}등급 (${data.count}과목)`;
  });
  return `\n## 학기별 성적 추이\n${terms.join("\n")}`;
}

// ── 교과이수적합도 섹션 빌드 ──
export function buildAdequacySection(enrichedContext?: DiagnosisEnrichedContext): string {
  if (!enrichedContext?.courseAdequacy) return "";

  const ca = enrichedContext.courseAdequacy;
  const rateDetails = ca.fusionRate != null
    ? `일반선택 ${ca.generalRate}% / 진로선택 ${ca.careerRate}% / 융합선택 ${ca.fusionRate}%`
    : `일반선택 ${ca.generalRate}% / 진로선택 ${ca.careerRate}%`;
  return `\n## 교과이수적합도
  · 목표전공: ${ca.majorCategory} / 이수율: ${ca.score}%
  · ${rateDetails}
  · 이수 완료: ${ca.taken.join(", ") || "없음"}
  · 미이수 추천: ${ca.notTaken.join(", ") || "없음"}${ca.notOffered.length > 0 ? `\n  · 학교 미개설: ${ca.notOffered.join(", ")}` : ""}`;
}

// ── 루브릭 갭 분석 섹션 빌드 ──
export function buildGapSection(rubricGaps: string[]): string {
  if (rubricGaps.length === 0) return "";
  return `\n## 루브릭 근거 갭 (${rubricGaps.length}건)
아래 질문은 AI 분석에서 등급을 산출하지 못했습니다 (텍스트에 근거 부족):
${rubricGaps.map((g) => `  · ${g}`).join("\n")}
이 갭을 약점 또는 보완 필요 영역으로 반영하세요.`;
}

// ── 수강계획 보강 섹션 빌드 (하이브리드 모드) ──
export function buildCoursePlanSection(
  coursePlanData: import("../../course-plan/types").CoursePlanTabData | null | undefined,
): string {
  if (!coursePlanData?.plans) return "";

  const plans = coursePlanData.plans.filter(
    (p) => p.plan_status === "confirmed" || p.plan_status === "recommended",
  );
  if (plans.length === 0) return "";

  const plansBySemester = new Map<string, string[]>();
  for (const p of plans) {
    const key = `${p.grade}학년 ${p.semester}학기`;
    if (!plansBySemester.has(key)) plansBySemester.set(key, []);
    const subjectName = (p.subject as { name?: string } | null)?.name ?? "과목 미정";
    plansBySemester.get(key)!.push(subjectName);
  }
  const plansText = [...plansBySemester.entries()]
    .map(([sem, subs]) => `  · ${sem}: ${subs.join(", ")}`)
    .join("\n");
  return `\n## 수강 계획 (비NEIS 학년 예정 교과)\n${plansText}\n위 수강계획 학년은 NEIS 데이터 없이 계획만 있습니다. 분석 데이터 학년과 연계하여 진단에 반영하세요.`;
}

// ── 시스템 프롬프트 빌드 ──
export function buildDiagnosisSystemPrompt(): string {
  return `당신은 대입 컨설팅 전문가입니다. 학생의 역량 평가 데이터를 종합하여 진단 보고서를 작성합니다.

## 진단 항목

1. overallGrade: 종합 등급 (A+/A-/B+/B/B-/C)
2. recordDirection: 생기부 기록 방향 (진로 일관성, 50자 이내)
3. directionStrength: 방향 강도 (strong/moderate/weak)
4. directionReasoning: 방향 강도 판단 근거 (100자 이내, 왜 strong/moderate/weak인지)
5. strengths: 강점 **반드시 3~5개** (아래 형식 준수)
6. weaknesses: 약점 **반드시 2~4개** (아래 형식 준수)
7. improvements: 개선 전략 **반드시 2~3개** (아래 형식 준수)
8. recommendedMajors: 추천 전공 2~3개 (다음 중 선택: ${MAJOR_LIST})
9. strategyNotes: 전략 메모 (500자 이내, 단기/중기/장기 구분하여 구체적으로)

## 강점/약점 작성 규칙 (매우 중요)

strengths의 각 항목 형식:
"[역량영역] 항목명 — 등급. 근거: 루브릭 질문 기반 설명. 증거: 태그 N건 등"

예시:
"[학업역량] 탐구력 — A+. 근거: 문제 제기→자료 분석→결론 도출 전 과정에서 논리적 성과. 증거: 긍정 태그 132건"

weaknesses의 각 항목 형식:
"[역량영역] 항목명 — 등급/갭 설명. 개선: 구체적 개선 방향"

예시:
"[진로역량] 전공 관련 교과 성취도 — B+. 기하 5등급으로 진로선택 성취 저조. 개선: 기하 보충학습 + 심화 과목 이수 계획"

improvements의 각 항목 형식:
{"priority": "높음|중간|낮음", "area": "영역명", "gap": "현재 갭", "action": "실행 방안", "outcome": "기대 효과"}

## 강점 추출 기준
- A+ 또는 A- 등급 항목에서 추출 (루브릭 질문별 상위 등급 비율 포함)
- 긍정 태그가 많은 항목 우선 (특히 [확정] 표시된 태그는 컨설턴트가 검증한 것이므로 가중치를 높게 반영)
- 반드시 3개 이상 작성할 것. 데이터가 있으면 빈 배열은 절대 불가.

## 약점 추출 기준
- B 이하 등급 항목, 또는 "근거없음" 루브릭 질문이 있는 항목
- needs_review 태그 비율이 높은 항목 (긍정 대비 30% 이상이면 깊이 부족)
- 성적 하락 추세가 있으면 반드시 약점에 포함
- **진로교과 세특 품질 약점 (중요)**: 희망 전공 관련 교과의 세특에서 아래 패턴이 발견되면 **별도 약점으로 반드시 추출**하세요:
${formatDiagnosisCareerWeakPatterns()}
  형식: "[진로역량] 진로교과 세특 품질 부족 — {과목명}. 근거: {구체적 문제}. 개선: {방향}"
- 반드시 2개 이상 작성할 것. 데이터가 있으면 빈 배열은 절대 불가.

## 합격률 낮은 생기부 패턴 감지
아래 패턴이 전체 기록에서 발견되면 약점 또는 strategyNotes에 반영하세요:
${formatDiagnosisMacroPatterns()}

## 기타 규칙
- **루브릭 질문별 등급**을 최우선 근거로 활용하세요. 항목 종합 등급만이 아닌 질문 단위로 강점/약점을 판단합니다.
- **"근거없음"** 표시된 루브릭 질문은 약점 또는 보완 필요 영역으로 반영하세요.
- 성적 추이가 제공되면 academic_achievement Q3 (학기별 추이) 평가에 활용하세요.
- 교과이수적합도가 제공되면 career 역량 진단에 반영하세요.
- 긍정 태그가 많아도 needs_review가 다수면 깊이 부족으로 판단하세요.
- **학년별 성장 구조**: 여러 학년 데이터가 있으면 아래 기준으로 성장 곡선을 평가하세요:
  - 고1→고2→고3으로 탐구 깊이가 심화되는가 (넓은 관심 → 선별 심화 → 확장+제언)
  - 학년 간 깊이가 동일하면 strategyNotes에 "성장 곡선 부재" 명시
  - 여러 교사가 동일한 역량을 공통 언급(교차 관찰 일관성)하면 해당 역량을 강점에 높은 가중치로 반영
- JSON으로만 응답`;
}

// ── 사용자 프롬프트 빌드 ──
export function buildDiagnosisUserPrompt(params: {
  studentInfo?: { targetMajor?: string; schoolName?: string; studentId?: string };
  activityTags: ActivityTag[];
  gradesSummary: string;
  tagsSummary: string;
  trendSection: string;
  adequacySection: string;
  gapSection: string;
  edgeSummarySection?: string;
  qualityPatternSection?: string;
  coursePlanSection: string;
}): string {
  const {
    studentInfo, activityTags, gradesSummary, tagsSummary,
    trendSection, adequacySection, gapSection,
    edgeSummarySection, qualityPatternSection, coursePlanSection,
  } = params;

  return `## 학생 정보
${studentInfo?.targetMajor ? `- 희망 전공: ${studentInfo.targetMajor}` : "- 희망 전공: 미정"}
${studentInfo?.schoolName ? `- 학교: ${studentInfo.schoolName}` : ""}

## 역량 등급 + 루브릭 질문별 상세 (10항목 × 2~4 질문)
${gradesSummary}

## 활동 태그 (총 ${activityTags.length}건)
${tagsSummary}
${trendSection}${adequacySection}${gapSection}
${edgeSummarySection ? `\n${edgeSummarySection}\n` : ""}${qualityPatternSection ? `\n${qualityPatternSection}\n` : ""}${coursePlanSection}
위 데이터를 종합하여 진단 보고서를 JSON으로 작성해주세요. 루브릭 질문 단위로 구체적 근거를 포함하세요. 세특 품질 패턴 분석이 제공된 경우 반복 감지된 패턴을 약점 및 개선 전략에 반드시 반영하세요.`;
}
