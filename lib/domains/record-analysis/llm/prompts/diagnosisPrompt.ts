// ============================================
// AI 종합 진단 프롬프트 빌딩 로직
// generateDiagnosis.ts에서 추출한 프롬프트 조립 함수들
// ============================================

import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS, COMPETENCY_RUBRIC_QUESTIONS, MAJOR_RECOMMENDED_COURSES } from "@/lib/domains/student-record/constants";
import type { CompetencyScore, ActivityTag, CompetencyItemCode } from "@/lib/domains/student-record/types";
import {
  formatDiagnosisCareerWeakPatterns,
  formatDiagnosisMacroPatterns,
} from "@/lib/domains/student-record/evaluation-criteria/defaults";
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
  coursePlanData: import("@/lib/domains/student-record/course-plan/types").CoursePlanTabData | null | undefined,
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
10. inferredEdges: 진단 서술 과정에서 **근거로 삼은 레코드 간 새 연결**을 배열로 제시 (0~10건)

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

## inferredEdges 작성 규칙 (L3-C 동적 연결 추론)

진단을 서술하면서 **이미 제공된 "영역간 연결 분석" 섹션에 없는 새로운 연결**이 보이면, 아래 형식으로 출력하세요. 이미 있는 연결은 재출력하지 마세요.

각 항목 형식:
{"sourceLabel": "출발 레코드 라벨", "targetLabel": "도착 레코드 라벨", "edgeType": "타입", "reason": "연결 근거 (100자 이내)", "sharedCompetencies": ["선택: 공유 역량 코드 배열"]}

**edgeType 허용값** (정확히 이 중 하나):
- TEACHER_VALIDATION: 여러 교사가 동일 역량을 교차 관찰
- COMPETENCY_SHARED: 두 활동이 동일 역량을 공유하며 서로를 심화
- COURSE_SUPPORTS: 교과 수업이 탐구·활동을 뒷받침
- TEMPORAL_GROWTH: 학년 심화 (예: 1→2학년 동일 주제 확장)
- CONTENT_REFERENCE: 한 활동이 다른 활동의 내용을 참조·활용
- READING_ENRICHES: 독서가 세특/창체의 탐구를 풍부하게 함
- THEME_CONVERGENCE: 서로 다른 활동이 같은 주제로 수렴

**엄격한 규칙** (지키지 않으면 전체 연결이 버려짐):
1. **라벨은 제공된 데이터(활동 태그·역량 증거·기존 연결)에 실제 등장한 정확한 라벨만** 사용. 새 라벨을 지어내지 말 것.
2. **진단의 강점·약점 서술에서 실제로 언급한 근거**만 연결로 제시. 추측·가설은 금지.
3. 기존 "영역간 연결 분석" 섹션에 이미 있는 연결은 **제외** (중복 검출로 버려짐).
4. sourceLabel과 targetLabel이 같으면 안 됨.
5. 최대 10건까지. 근거가 약하면 빈 배열 '[]' 반환이 맞음.

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
- **학년별 과목 교차 테마** (H1 섹션이 제공되면):
  - 각 학년의 dominant 테마가 ≥2과목에 걸쳐 반복되는지, 학년이 올라가며 심화(deepening)되는지 평가
  - 다학년 반복 테마가 존재하면 전공 정합성의 **강점 증거**로 구체 인용 (예: \`social-minority\`가 1→2→3학년 모두 dominant)
  - 모든 학년 dominant가 단일 진로 키워드에만 수렴하고 교과 맥락이 부족하면 **진로과잉도배(F16)** 약점으로 명시하고 strategyNotes에도 경고
  - 학년 간 테마가 서로 이질적이고 pivot이 반복되면 "방향 정체성 약함"으로 directionStrength에 반영
- **Prospective 모드 (수강계획 기반 예비진단)**:
  - 1학년 시작 시점이라면 NEIS 분석 데이터 0건은 "약점"이 아니라 "출발점"입니다.
  - 교과이수적합도 0%, 역량 등급 미평가 → 결여로 판정하지 마세요. 대신 수강 계획 방향성과 Blueprint 정합도를 기준으로 평가하세요.
  - overallGrade는 "현재 기록의 질"이 아니라 "설계 방향의 타당성"으로 산정합니다.
  - directionStrength는 Blueprint가 제공되었으면 Blueprint와의 정합도, 없으면 수강계획+진로 일관성으로 판정합니다.
  - 강점에는 "설계 전략의 논리성", "수강계획과 진로의 부합도" 등을 포함하세요.
  - 약점에는 "기초 교과 커버 부족", "수렴 설계 공백" 등 설계 차원의 위험 요소만 포함하세요. "이수율 0%"는 약점이 아닙니다.
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
  crossSubjectThemesSection?: string;
  coursePlanSection: string;
  /** Phase δ-6 (G11): 활성 메인 탐구 섹션. tier 정합성 평가 기준. */
  mainExplorationSection?: string;
  /**
   * S2 narrative_arc_extraction 산출물 기반 8단계 서사 완성도 섹션.
   * buildNarrativeArcDiagnosisSection()이 생성한 섹션을 전달. 없으면 생략.
   */
  narrativeArcSection?: string;
  /**
   * β 격차 1: MidPipeline Planner 메타 판정 섹션 (buildMidPlanSynthesisSection() 결과).
   * focusHypothesis / concernFlags 를 진단 방향에 반영하기 위해 주입한다.
   * undefined 이면 섹션 자체 생략 (no-op).
   */
  midPlanSynthesisSection?: string;
  /**
   * 격차 6: 학종 3요소 통합 점수 섹션 (buildHakjongScoreSection() 결과).
   * α2 Reward 엔진이 계산한 학업/진로/공동체 0~100 점수.
   * 스냅샷 없거나 미계산 시 undefined (no-op).
   */
  hakjongScoreSection?: string;
  /**
   * Phase B G3: 이번 실행 학년 지배 교과 교차 테마 섹션 (buildGradeThemesSection() 결과).
   * P3.5 cross_subject_theme_extraction 이 ctx.belief.gradeThemes 에 저장한 결과.
   * undefined 이면 섹션 생략 (no-op).
   */
  gradeThemesSection?: string;
  /**
   * Phase B G2: 통합 테마(hyperedge) 요약 섹션 (buildHyperedgeSummarySection() 결과).
   * Layer 2 N-ary 수렴 서사축. undefined 이면 섹션 생략 (no-op).
   */
  hyperedgeSummarySection?: string;
  /**
   * Phase B G5: 학생 정체성 프로필 카드 텍스트 (ctx.belief.profileCard).
   * 이전 학년 역량/품질 누적 카드. undefined/"" 이면 섹션 생략 (no-op).
   */
  profileCardSection?: string;
  /** B1: NEIS 데이터 없는 설계 모드 → prospective 프레임 활성화 */
  isProspective?: boolean;
}): string {
  const {
    studentInfo, activityTags, gradesSummary, tagsSummary,
    trendSection, adequacySection, gapSection,
    edgeSummarySection, qualityPatternSection, crossSubjectThemesSection, coursePlanSection,
    mainExplorationSection, narrativeArcSection, midPlanSynthesisSection, hakjongScoreSection,
    gradeThemesSection, hyperedgeSummarySection, profileCardSection, isProspective,
  } = params;

  const prospectiveBanner = isProspective
    ? `# 🚨 PROSPECTIVE 모드 — 우선 적용되는 규칙

이 학생은 **1학년 시작 시점**이며 NEIS 기록이 전혀 없고 수강 계획만 있습니다.
아래 규칙은 시스템 프롬프트의 일반 "약점 추출 기준"보다 **우선 적용**됩니다:

1. **"이수율 0%", "진로 관련 과목 이수 경험 없음", "전공 관련 교과 이수 노력 부족", "탐구 활동 전무"** 등 "기록이 없다"를 근거로 한 판정은 **weaknesses에 절대 포함 금지**. 1학년은 이수·활동이 시작되기 전이므로 "없다"는 것은 결여가 아니라 정상 출발 상태입니다.
2. **진로교과 세특 품질 약점**(시스템 프롬프트의 진로교과 패턴) 규칙도 **적용 금지** — 세특이 없으니 품질을 논할 수 없음.
3. **합격률 낮은 패턴 감지** 규칙도 **적용 금지** — 기록이 없어 패턴을 측정할 수 없음.
4. **weaknesses는 "설계 차원 위험"만 포함**하세요:
   - Blueprint 수렴 설계 공백 (예: "1학년 foundational 수렴이 1개 미만")
   - 수강 계획의 진로 정합도 부족 (예: "의학 지망인데 생명과학 계열 과목 미확정")
   - Bridge 제안(Gap Tracker) 중 urgency=high 항목
5. **strengths는 "설계 방향의 타당성"으로 구성**:
   - 수강 계획과 진로의 부합도
   - Blueprint 청사진의 3년 일관성
   - 진로 정체성 키워드의 구체성
6. **overallGrade/directionStrength**: "현재 기록의 질"이 아닌 "설계 방향의 타당성"으로 산정. 1학년 prospective 학생에게 일반적으로 overall=B, directionStrength=moderate 이상이 합리적 (심각한 방향성 문제 없는 한).

`
    : "";

  return `${prospectiveBanner}## 학생 정보
${studentInfo?.targetMajor ? `- 희망 전공: ${studentInfo.targetMajor}` : "- 희망 전공: 미정"}
${studentInfo?.schoolName ? `- 학교: ${studentInfo.schoolName}` : ""}

## 역량 등급 + 루브릭 질문별 상세 (10항목 × 2~4 질문)
${gradesSummary}

## 활동 태그 (총 ${activityTags.length}건)
${tagsSummary}
${trendSection}${adequacySection}${gapSection}
${edgeSummarySection ? `\n${edgeSummarySection}\n` : ""}${qualityPatternSection ? `\n${qualityPatternSection}\n` : ""}${crossSubjectThemesSection ? `\n${crossSubjectThemesSection}\n` : ""}${narrativeArcSection ? `\n${narrativeArcSection}\n` : ""}${mainExplorationSection ? `\n${mainExplorationSection}\n` : ""}${midPlanSynthesisSection ? `\n${midPlanSynthesisSection}\n` : ""}${hakjongScoreSection ? `\n${hakjongScoreSection}\n` : ""}${gradeThemesSection ? `\n${gradeThemesSection}\n` : ""}${hyperedgeSummarySection ? `\n${hyperedgeSummarySection}\n` : ""}${profileCardSection ? `\n${profileCardSection}\n` : ""}${coursePlanSection}
위 데이터를 종합하여 진단 보고서를 JSON으로 작성해주세요. 루브릭 질문 단위로 구체적 근거를 포함하세요. 세특 품질 패턴 분석이 제공된 경우 반복 감지된 패턴을 약점 및 개선 전략에 반드시 반영하세요. 학년별 과목 교차 테마가 제공된 경우 다학년 반복·심화 테마를 강점 증거로 구체 인용하고, 단일 진로 수렴 시 진로과잉도배 약점으로 명시하세요. 세특 서사 완성도(8단계 분석)가 제공된 경우 핵심 4단계(①호기심 ②주제 ③탐구 ⑤결론) 충족률과 누락 패턴을 약점 또는 개선 전략에 반드시 반영하세요. 메인 탐구가 제공된 경우, 학생의 활동·역량이 메인 탐구 tier_plan(기초/발전/심화) 과 정합하는지 평가하여 강점 또는 약점에 반드시 반영하세요. 컨설턴트 메타 판정(핵심 탐구 축 가설)이 제공된 경우, 해당 가설 방향의 약점을 우선 해석하고 우려 플래그가 있으면 약점 및 개선 전략에 반드시 반영하세요.`;
}
