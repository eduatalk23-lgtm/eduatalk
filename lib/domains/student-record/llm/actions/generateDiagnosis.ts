"use server";

// ============================================
// AI 종합 진단 생성 Server Action
// 역량 등급 + 루브릭 질문별 상세 + 태그 + 성적추이 + 교과이수적합도
// → 강점/약점/추천전공 자동 도출
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { extractJson } from "../extractJson";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS, COMPETENCY_RUBRIC_QUESTIONS, MAJOR_RECOMMENDED_COURSES } from "../../constants";
import type { CompetencyScore, ActivityTag, CompetencyItemCode } from "../../types";

const LOG_CTX = { domain: "student-record", action: "generateDiagnosis" };

const MAJOR_LIST = Object.keys(MAJOR_RECOMMENDED_COURSES).join(", ");

export interface DiagnosisImprovement {
  priority: "높음" | "중간" | "낮음";
  area: string;
  gap: string;
  action: string;
  outcome: string;
}

interface DiagnosisGenerationResult {
  overallGrade: string;
  recordDirection: string;
  directionStrength: "strong" | "moderate" | "weak";
  directionReasoning: string;
  strengths: string[];
  weaknesses: string[];
  improvements: DiagnosisImprovement[];
  recommendedMajors: string[];
  strategyNotes: string;
  warnings?: string[];
}

/** 진단에 전달할 보강 컨텍스트 */
export interface DiagnosisEnrichedContext {
  gradeTrend?: Array<{ grade: number; semester: number; subjectName: string; rankGrade: number | string }>;
  courseAdequacy?: {
    score: number;
    majorCategory: string;
    taken: string[];
    notTaken: string[];
    notOffered: string[];
    generalRate: number;
    careerRate: number;
    fusionRate: number | null;
  } | null;
}

export async function generateAiDiagnosis(
  competencyScores: CompetencyScore[],
  activityTags: ActivityTag[],
  studentInfo?: { targetMajor?: string; schoolName?: string; studentId?: string },
  edgeSummarySection?: string,
  enrichedContext?: DiagnosisEnrichedContext,
  /** 엣지의 shared_competencies에서 집계한 역량별 연결 빈도 (P2-1: 고립 역량 약점) */
  edgeCompetencyFreq?: Map<string, number>,
): Promise<{ success: true; data: DiagnosisGenerationResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (competencyScores.length === 0 && activityTags.length === 0) {
      return { success: false, error: "역량 등급이나 활동 태그 데이터가 없습니다. 먼저 역량 분석을 실행해주세요." };
    }

    // enrichedContext 자동 조회: studentId가 있고 enrichedContext가 없으면 DB에서 조립
    if (!enrichedContext && studentInfo?.studentId) {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();

      // 성적 추이
      const { data: trendRows } = await supabase
        .from("student_internal_scores")
        .select("subject:subject_id(name), rank_grade, grade, semester")
        .eq("student_id", studentInfo.studentId)
        .order("grade")
        .order("semester");
      type TrendRow = { subject: { name: string } | null; rank_grade: number | null; grade: number | null; semester: number | null };
      const typedTrendRows = (trendRows ?? []) as unknown as TrendRow[];
      const gradeTrend = typedTrendRows
        .filter((s) => s.rank_grade != null)
        .map((s) => ({
          grade: s.grade ?? 1,
          semester: s.semester ?? 1,
          subjectName: s.subject?.name ?? "",
          rankGrade: s.rank_grade!,
        }));

      // 교과이수적합도
      let courseAdequacy: DiagnosisEnrichedContext["courseAdequacy"] = null;
      if (studentInfo.targetMajor) {
        const { calculateCourseAdequacy } = await import("../../course-adequacy");
        const { calculateSchoolYear, getCurriculumYear } = await import("@/lib/utils/schoolYear");
        const { data: student } = await supabase
          .from("students")
          .select("grade")
          .eq("id", studentInfo.studentId)
          .maybeSingle();
        const studentGrade = (student?.grade as number) ?? 3;
        const enrollYear = calculateSchoolYear() - studentGrade + 1;
        const curYear = getCurriculumYear(enrollYear);
        const takenNames = [...new Set(gradeTrend.map((s: { subjectName: string }) => s.subjectName))];
        const result = calculateCourseAdequacy(studentInfo.targetMajor, takenNames, null, curYear);
        if (result) {
          courseAdequacy = {
            score: result.score,
            majorCategory: result.majorCategory,
            taken: result.taken,
            notTaken: result.notTaken,
            notOffered: result.notOffered,
            generalRate: result.generalRate,
            careerRate: result.careerRate,
            fusionRate: result.fusionRate,
          };
        }
      }

      enrichedContext = { gradeTrend, courseAdequacy };
    }

    // ── 역량 등급 + 루브릭 질문별 상세 요약 ──
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

    // ── 활동 태그 요약 — 레코드 유형별 분류 ──
    const tagsByItem = new Map<string, TagItemStats>();
    for (const t of activityTags) {
      const key = t.competency_item;
      const entry: TagItemStats = tagsByItem.get(key) ?? { positive: 0, negative: 0, needs_review: 0, confirmed: 0, total: 0, byType: new Map(), samples: [] as string[] };
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

    const tagsSummary = [
      `활동 태그 분석 (총 ${activityTags.length}건):`,
      ...Array.from(tagsByItem.entries()).map(([item, stats]) => {
        const label = COMPETENCY_ITEMS.find((i) => i.code === item)?.label ?? item;
        const parts: string[] = [];
        if (stats.positive > 0) parts.push(`긍정 ${stats.positive}건`);
        if (stats.negative > 0) parts.push(`부정 ${stats.negative}건`);
        if (stats.needs_review > 0) parts.push(`확인필요 ${stats.needs_review}건`);
        const counts = parts.join(", ");
        // 확정 비율 (confirmed 태그는 컨설턴트가 검증한 것이므로 신뢰도 높음)
        const confirmInfo = stats.confirmed > 0 ? ` [확정 ${stats.confirmed}/${stats.total}건]` : "";
        // 레코드 유형별 분포
        const typeBreakdown = [...stats.byType.entries()].map(([type, cnt]) => `${type} ${cnt}`).join(", ");
        const samples = stats.samples.length > 0 ? `\n    예: ${stats.samples.join("; ")}` : "";
        return `  - ${label}: ${counts}${confirmInfo} (${typeBreakdown})${samples}`;
      }),
    ].filter(Boolean).join("\n");

    // ── 성적 추이 섹션 ──
    let trendSection = "";
    if (enrichedContext?.gradeTrend && enrichedContext.gradeTrend.length > 0) {
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
      trendSection = `\n## 학기별 성적 추이\n${terms.join("\n")}`;
    }

    // ── 교과이수적합도 섹션 ──
    let adequacySection = "";
    if (enrichedContext?.courseAdequacy) {
      const ca = enrichedContext.courseAdequacy;
      const rateDetails = ca.fusionRate != null
        ? `일반선택 ${ca.generalRate}% / 진로선택 ${ca.careerRate}% / 융합선택 ${ca.fusionRate}%`
        : `일반선택 ${ca.generalRate}% / 진로선택 ${ca.careerRate}%`;
      adequacySection = `\n## 교과이수적합도
  · 목표전공: ${ca.majorCategory} / 이수율: ${ca.score}%
  · ${rateDetails}
  · 이수 완료: ${ca.taken.join(", ") || "없음"}
  · 미이수 추천: ${ca.notTaken.join(", ") || "없음"}${ca.notOffered.length > 0 ? `\n  · 학교 미개설: ${ca.notOffered.join(", ")}` : ""}`;
    }

    // ── 루브릭 갭 분석 섹션 ──
    let gapSection = "";
    if (rubricGaps.length > 0) {
      gapSection = `\n## 루브릭 근거 갭 (${rubricGaps.length}건)
아래 질문은 AI 분석에서 등급을 산출하지 못했습니다 (텍스트에 근거 부족):
${rubricGaps.map((g) => `  · ${g}`).join("\n")}
이 갭을 약점 또는 보완 필요 영역으로 반영하세요.`;
    }

    // ── 시스템 프롬프트 ──
    const systemPrompt = `당신은 대입 컨설팅 전문가입니다. 학생의 역량 평가 데이터를 종합하여 진단 보고서를 작성합니다.

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
  - 진로교과인데 탐구 활동이 피상적 (수행평가 나열식, 구체적 탐구 없음)
  - 진로교과인데 세특 내용이 상투적/추상적 (복붙 의심)
  - 진로교과 성적은 낮은데(B 이하) 세특에 대학원급 심화 내용 (내신↔탐구 불일치 = 대리작성 의심)
  - 진로교과에서 탐구 결론이 자명하거나, 실험설계 오류, 인과 단절이 있는 경우
  형식: "[진로역량] 진로교과 세특 품질 부족 — {과목명}. 근거: {구체적 문제}. 개선: {방향}"
- 반드시 2개 이상 작성할 것. 데이터가 있으면 빈 배열은 절대 불가.

## 합격률 낮은 생기부 패턴 감지
아래 패턴이 전체 기록에서 발견되면 약점 또는 strategyNotes에 반영하세요:
- **성장 곡선 부재**: 학년 간 탐구 깊이가 동일 → "학년별 심화 과정이 드러나지 않음"
- **전공 스토리라인 단절**: 교과/창체/동아리가 각각 다른 방향 → "진로 일관성 약함"
- **자기주도성 부재**: 모든 활동이 교사 과제 중심, 학생 주도 탐구 흔적 없음
- **진로 과잉 도배**: 모든 교과에 동일 키워드 강제 삽입, 각 교과 고유 역량 불명확

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

    // ── 사용자 프롬프트 ──
    const userPrompt = `## 학생 정보
${studentInfo?.targetMajor ? `- 희망 전공: ${studentInfo.targetMajor}` : "- 희망 전공: 미정"}
${studentInfo?.schoolName ? `- 학교: ${studentInfo.schoolName}` : ""}

## 역량 등급 + 루브릭 질문별 상세 (10항목 × 2~4 질문)
${gradesSummary}

## 활동 태그 (총 ${activityTags.length}건)
${tagsSummary}
${trendSection}${adequacySection}${gapSection}
${edgeSummarySection ? `\n${edgeSummarySection}\n` : ""}
위 데이터를 종합하여 진단 보고서를 JSON으로 작성해주세요. 루브릭 질문 단위로 구체적 근거를 포함하세요.`;

    // Q2: 입력 복잡도 기반 모델 선택 — 태그 20개+ 또는 점수 8개+ → standard, 그 외 fast
    const inputComplexity = competencyScores.length + activityTags.length;
    const diagModelTier = inputComplexity >= 20 ? "standard" : "fast";

    const result = await generateTextWithRateLimit({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: diagModelTier,
      temperature: 0.3,
      maxTokens: 4000,
      responseFormat: "json",
    });

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJson<Record<string, unknown>>(result.content);
    } catch {
      return { success: false, error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요." };
    }

    if (!parsed || typeof parsed !== "object") {
      return { success: false, error: "AI 응답 형식이 올바르지 않습니다." };
    }

    const validGrades = new Set(["A+", "A-", "B+", "B", "B-", "C"]);
    const validStrengths = new Set(["strong", "moderate", "weak"]);

    const gradeFallback = !(typeof parsed.overallGrade === "string" && validGrades.has(parsed.overallGrade));
    const strengthFallback = !(typeof parsed.directionStrength === "string" && validStrengths.has(parsed.directionStrength));

    let aiStrengths = Array.isArray(parsed.strengths) ? parsed.strengths.filter((s): s is string => typeof s === "string" && s.length > 0) : [];
    let aiWeaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter((s): s is string => typeof s === "string" && s.length > 0) : [];

    const warnings: string[] = [];
    if (!edgeSummarySection) warnings.push("영역간 연결 분석 없이 생성되었습니다 (엣지 데이터 미제공)");
    if (gradeFallback) warnings.push("종합등급이 기본값(B)으로 설정되었습니다");
    if (strengthFallback) warnings.push("방향 강도가 기본값(보통)으로 설정되었습니다");

    // ── P0: 강점/약점 빈 배열 방어 — 프로그래밍 방식 fallback ──
    if (aiStrengths.length < 3) {
      const generated = generateStrengthsFallback(competencyScores, tagsByItem);
      aiStrengths = [...aiStrengths, ...generated].slice(0, 5);
      if (generated.length > 0) warnings.push(`강점 ${generated.length}건이 자동 생성되었습니다`);
    }
    if (aiWeaknesses.length < 2) {
      const generated = generateWeaknessesFallback(competencyScores, tagsByItem, rubricGaps, enrichedContext, edgeCompetencyFreq);
      aiWeaknesses = [...aiWeaknesses, ...generated].slice(0, 4);
      if (generated.length > 0) warnings.push(`약점 ${generated.length}건이 자동 생성되었습니다`);
    }

    // improvements 파싱 (신규 필드) + fallback
    let aiImprovements = parseImprovements(parsed.improvements);
    if (aiImprovements.length < 2) {
      const generated = generateImprovementsFallback(competencyScores, tagsByItem, rubricGaps, enrichedContext);
      aiImprovements = [...aiImprovements, ...generated].slice(0, 5);
      if (generated.length > 0) warnings.push(`개선전략 ${generated.length}건이 자동 생성되었습니다`);
    }

    if (warnings.length > 0) {
      logActionWarn(LOG_CTX, "AI 진단 응답에 fallback 적용", {
        gradeFallback: gradeFallback ? `"${String(parsed.overallGrade)}" → "B"` : null,
        strengthFallback: strengthFallback ? `"${String(parsed.directionStrength)}" → "moderate"` : null,
        strengthsCount: aiStrengths.length,
        weaknessesCount: aiWeaknesses.length,
      });
    }

    return {
      success: true,
      data: {
        overallGrade: !gradeFallback ? (parsed.overallGrade as string) : "B",
        recordDirection: String(parsed.recordDirection ?? "").slice(0, 50),
        directionStrength: !strengthFallback ? (parsed.directionStrength as "strong" | "moderate" | "weak") : "moderate",
        directionReasoning: String(parsed.directionReasoning ?? ""),
        strengths: aiStrengths,
        weaknesses: aiWeaknesses,
        improvements: aiImprovements,
        recommendedMajors: Array.isArray(parsed.recommendedMajors) ? parsed.recommendedMajors.filter((s): s is string => typeof s === "string" && s.length > 0) : [],
        strategyNotes: String(parsed.strategyNotes ?? "").slice(0, 500),
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다." };
    }
    return { success: false, error: "종합 진단 생성 중 오류가 발생했습니다." };
  }
}

// ═══════════════════════════════════════════
// P0: 프로그래밍 방식 fallback 생성 함수들
// ═══════════════════════════════════════════

type TagItemStats = { positive: number; negative: number; needs_review: number; confirmed: number; total: number; byType: Map<string, number>; samples: string[] };

const IMPROVEMENT_SUGGESTIONS: Record<string, string> = {
  academic_achievement: "전공 핵심 교과 집중 학습 + 내신 등급 향상",
  academic_attitude: "수업 참여도 강화 + 자기주도학습 기록 구체화",
  academic_inquiry: "교과 심화 탐구 보고서 작성 + 학술 발표 경험 확보",
  career_course_effort: "전공 관련 진로선택 과목 추가 이수",
  career_course_achievement: "전공 관련 과목 성취도 향상 + 보충학습",
  career_exploration: "진로 관련 활동 심화 + 구체적 성과 기록",
  community_collaboration: "팀 프로젝트 주도적 참여 + 협업 성과 기록",
  community_caring: "멘토링/봉사활동 지속 + 구체적 사례 기록",
  community_integrity: "출결/과제 관리 강화 + 자기관리 역량 입증",
  community_leadership: "학급/동아리 임원 활동 + 리더십 경험 확대",
};

/** 루브릭 등급 + 태그 기반으로 강점 자동 생성 */
function generateStrengthsFallback(
  scores: CompetencyScore[],
  tagsByItem: Map<string, TagItemStats>,
): string[] {
  const results: string[] = [];

  // 컨설턴트 > AI 우선, 높은 등급 항목만
  const seen = new Set<string>();
  const sorted = [...scores]
    .sort((a, b) => {
      // 컨설턴트 우선
      if (a.source === "manual" && b.source !== "manual") return -1;
      if (a.source !== "manual" && b.source === "manual") return 1;
      return 0;
    });

  for (const sc of sorted) {
    if (seen.has(sc.competency_item)) continue;
    seen.add(sc.competency_item);

    const grade = sc.grade_value ?? "";
    if (!["A+", "A-"].includes(grade)) continue;

    const item = COMPETENCY_ITEMS.find((i) => i.code === sc.competency_item);
    if (!item) continue;

    const area = COMPETENCY_AREA_LABELS[item.area];
    const tags = tagsByItem.get(sc.competency_item);
    const posCount = tags?.positive ?? 0;

    // 루브릭 상위 비율 계산
    const rubrics = Array.isArray(sc.rubric_scores) ? sc.rubric_scores as Array<{ grade: string }> : [];
    const topCount = rubrics.filter((r) => ["A+", "A-"].includes(r.grade)).length;
    const rubricInfo = rubrics.length > 0 ? `루브릭 ${topCount}/${rubrics.length} 상위` : "";

    const evidence = posCount > 0 ? `긍정 태그 ${posCount}건` : "";
    const parts = [rubricInfo, evidence].filter(Boolean).join(", ");

    results.push(`[${area}] ${item.label} — ${grade}. ${parts ? `근거: ${parts}` : ""}`);
  }

  return results.slice(0, 5);
}

/**
 * 엣지의 shared_competencies에서 역량 연결 빈도를 집계하고,
 * 연결이 0건인 역량 항목(고립 역량)을 약점 후보로 반환.
 */
function findIsolatedCompetencyWeaknesses(
  scores: CompetencyScore[],
  edgeCompetencyFreq: Map<string, number>,
): string[] {
  if (edgeCompetencyFreq.size === 0) return [];

  const results: string[] = [];
  const seen = new Set<string>();

  for (const sc of scores) {
    if (seen.has(sc.competency_item)) continue;
    seen.add(sc.competency_item);

    const freq = edgeCompetencyFreq.get(sc.competency_item) ?? 0;
    if (freq > 0) continue; // 연결 있음 → 고립 아님

    const item = COMPETENCY_ITEMS.find((i) => i.code === sc.competency_item);
    if (!item) continue;

    const area = COMPETENCY_AREA_LABELS[item.area];
    results.push(`[${area}] ${item.label} — 교과간 연결 부재. 개선: 다른 교과와 융합 탐구 활동 확대`);
  }

  return results.slice(0, 2);
}

/** 루브릭 갭 + 낮은 등급 + 태그 기반으로 약점 자동 생성 */
function generateWeaknessesFallback(
  scores: CompetencyScore[],
  tagsByItem: Map<string, TagItemStats>,
  rubricGaps: string[],
  enrichedContext?: DiagnosisEnrichedContext,
  edgeCompetencyFreq?: Map<string, number>,
): string[] {
  const results: string[] = [];

  // 낮은 등급 항목
  const seen = new Set<string>();
  const sorted = [...scores]
    .sort((a, b) => {
      if (a.source === "manual" && b.source !== "manual") return -1;
      if (a.source !== "manual" && b.source === "manual") return 1;
      return 0;
    });

  for (const sc of sorted) {
    if (seen.has(sc.competency_item)) continue;
    seen.add(sc.competency_item);

    const grade = sc.grade_value ?? "";
    if (!["B+", "B", "B-", "C"].includes(grade)) continue;

    const item = COMPETENCY_ITEMS.find((i) => i.code === sc.competency_item);
    if (!item) continue;

    const area = COMPETENCY_AREA_LABELS[item.area];
    const suggestion = IMPROVEMENT_SUGGESTIONS[sc.competency_item] ?? "해당 영역 보강 활동 필요";

    results.push(`[${area}] ${item.label} — ${grade}. 개선: ${suggestion}`);
  }

  // needs_review 태그 비율 높은 항목 (깊이 부족)
  for (const [itemCode, stats] of tagsByItem) {
    if (seen.has(itemCode) && results.length >= 2) continue;
    const total = stats.positive + stats.negative + stats.needs_review;
    if (total === 0 || stats.needs_review / total < 0.3) continue;

    const item = COMPETENCY_ITEMS.find((i) => i.code === itemCode);
    if (!item) continue;

    const area = COMPETENCY_AREA_LABELS[item.area];
    const pct = Math.round(stats.needs_review / total * 100);
    results.push(`[${area}] ${item.label} — 활동 깊이 부족 (확인필요 ${pct}%). 개선: 핵심 활동 심화 탐구 + 구체적 성과 기록`);
    seen.add(itemCode);
  }

  // 루브릭 갭이 있으면 추가
  if (rubricGaps.length > 0 && results.length < 4) {
    results.push(`[종합] 루브릭 근거 부족 ${rubricGaps.length}건. 개선: 해당 영역 활동 기록 보강 필요`);
  }

  // 엣지 기반 고립 역량
  if (edgeCompetencyFreq && edgeCompetencyFreq.size > 0 && results.length < 4) {
    const isolated = findIsolatedCompetencyWeaknesses(scores, edgeCompetencyFreq);
    for (const w of isolated) {
      if (results.length >= 4) break;
      if (!results.some((r) => r.includes("연결 부재"))) results.push(w);
    }
  }

  // 성적 하락 추세
  if (enrichedContext?.gradeTrend && enrichedContext.gradeTrend.length > 0) {
    const termMap = new Map<string, { sum: number; count: number }>();
    for (const s of enrichedContext.gradeTrend) {
      const key = `${s.grade}-${s.semester}`;
      const entry = termMap.get(key) ?? { sum: 0, count: 0 };
      entry.sum += s.rankGrade;
      entry.count++;
      termMap.set(key, entry);
    }
    const avgs = [...termMap.values()].map((d) => d.sum / d.count);
    if (avgs.length >= 2 && avgs[avgs.length - 1] > avgs[0] + 0.3) {
      const first = avgs[0].toFixed(1);
      const last = avgs[avgs.length - 1].toFixed(1);
      if (!results.some((r) => r.includes("하락"))) {
        results.push(`[학업역량] 성적 추이 하락 — ${first}→${last}등급. 개선: 취약 과목 집중 보완 + 반등 전략`);
      }
    }
  }

  return results.slice(0, 4);
}

/** improvements 배열 파싱 (AI 응답이 올바른 형식이 아닐 수 있음) */
function parseImprovements(raw: unknown): DiagnosisImprovement[] {
  if (!Array.isArray(raw)) return [];
  const validPriorities = new Set(["높음", "중간", "낮음"]);
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      priority: (validPriorities.has(String(item.priority)) ? String(item.priority) : "중간") as DiagnosisImprovement["priority"],
      area: String(item.area ?? ""),
      gap: String(item.gap ?? ""),
      action: String(item.action ?? ""),
      outcome: String(item.outcome ?? ""),
    }))
    .filter((item) => item.area && item.action)
    .slice(0, 5);
}

/** 낮은 등급 + 루브릭 갭 + 미이수 과목 기반으로 개선전략 자동 생성 */
function generateImprovementsFallback(
  scores: CompetencyScore[],
  tagsByItem: Map<string, TagItemStats>,
  rubricGaps: string[],
  enrichedContext?: DiagnosisEnrichedContext,
): DiagnosisImprovement[] {
  const results: DiagnosisImprovement[] = [];
  const seen = new Set<string>();

  // 낮은 등급 항목 → 개선전략
  const sorted = [...scores].sort((a, b) => {
    if (a.source === "manual" && b.source !== "manual") return -1;
    if (a.source !== "manual" && b.source === "manual") return 1;
    return 0;
  });

  const GRADE_PRIORITY: Record<string, DiagnosisImprovement["priority"]> = {
    C: "높음", "B-": "높음", B: "중간", "B+": "중간",
  };

  for (const sc of sorted) {
    if (results.length >= 3) break;
    if (seen.has(sc.competency_item)) continue;
    seen.add(sc.competency_item);

    const grade = sc.grade_value ?? "";
    const priority = GRADE_PRIORITY[grade];
    if (!priority) continue;

    const item = COMPETENCY_ITEMS.find((i) => i.code === sc.competency_item);
    if (!item) continue;

    const area = COMPETENCY_AREA_LABELS[item.area];
    const action = IMPROVEMENT_SUGGESTIONS[sc.competency_item] ?? "해당 영역 보강 활동 필요";
    const tags = tagsByItem.get(sc.competency_item);
    const reviewPct = tags ? Math.round(tags.needs_review / Math.max(tags.positive + tags.negative + tags.needs_review, 1) * 100) : 0;
    const gapInfo = reviewPct > 20 ? `${grade} 등급, 확인필요 비율 ${reviewPct}%` : `${grade} 등급`;

    results.push({
      priority,
      area: `[${area}] ${item.label}`,
      gap: gapInfo,
      action,
      outcome: "해당 역량 등급 향상 및 관련 활동 강화",
    });
  }

  // 미이수 과목 기반 추가
  if (results.length < 3 && enrichedContext?.courseAdequacy?.notTaken?.length) {
    const top3 = enrichedContext.courseAdequacy.notTaken.slice(0, 3);
    results.push({
      priority: "중간",
      area: "[진로역량] 전공 관련 교과 이수",
      gap: `미이수 ${enrichedContext.courseAdequacy.notTaken.length}과목`,
      action: `${top3.join(", ")} 등 이수 계획 수립`,
      outcome: "전공 관련 교과이수 적합도 향상",
    });
  }

  // 루브릭 갭 기반 추가
  if (results.length < 3 && rubricGaps.length > 0) {
    results.push({
      priority: "중간",
      area: "[종합] 루브릭 근거 보강",
      gap: `근거 부족 ${rubricGaps.length}건`,
      action: "해당 역량 관련 활동 기록 + 구체적 성과 서술 보강",
      outcome: "루브릭 평가 근거 확보",
    });
  }

  return results;
}

// ============================================
// Phase V1: Prospective 진단 — 수강계획 기반 예비 진단
// ============================================

export interface ProspectiveDiagnosisResult {
  overallGrade: string;
  recordDirection: string;
  directionStrength: "strong" | "moderate" | "weak";
  directionReasoning: string;
  strengths: string[];
  weaknesses: string[];
  improvements: DiagnosisImprovement[];
  recommendedMajors: string[];
  strategyNotes: string;
}

/** 수강계획+진로 기반 예비 진단 생성 (기록 없는 신입생/1학년 대상) */
export async function generateProspectiveDiagnosis(
  studentId: string,
  tenantId: string,
  coursePlanData: import("../../course-plan/types").CoursePlanTabData | null,
  snapshot: Record<string, unknown> | null,
): Promise<{ success: true; data: ProspectiveDiagnosisResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    const plans = coursePlanData?.plans?.filter(
      (p) => p.plan_status === "confirmed" || p.plan_status === "recommended",
    ) ?? [];

    if (plans.length === 0) {
      return { success: false, error: "수강 계획이 없어 예비 진단을 생성할 수 없습니다." };
    }

    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const { calculateSchoolYear } = await import("@/lib/utils/schoolYear");
    const supabase = await createSupabaseServerClient();

    const targetMajor = (snapshot?.target_major as string) ?? null;
    const studentGrade = (snapshot?.grade as number) ?? 1;

    // 수강계획 요약 텍스트 구성
    const plansBySemester = new Map<string, string[]>();
    for (const p of plans) {
      const key = `${p.grade}학년 ${p.semester}학기`;
      if (!plansBySemester.has(key)) plansBySemester.set(key, []);
      const subjectName = (p.subject as { name?: string } | null)?.name ?? "과목 미정";
      const subjectType = (p.subject as { subject_type?: { name?: string } } | null)?.subject_type?.name;
      plansBySemester.get(key)!.push(subjectType ? `${subjectName}(${subjectType})` : subjectName);
    }
    const plansText = [...plansBySemester.entries()]
      .map(([sem, subs]) => `- ${sem}: ${subs.join(", ")}`)
      .join("\n");

    // 추천 교과 적합성 사전 조회 (진로 있으면)
    let courseAdequacyText = "";
    if (targetMajor) {
      try {
        const { calculateCourseAdequacy } = await import("../../course-adequacy");
        const { getCurriculumYear } = await import("@/lib/utils/schoolYear");
        const enrollYear = calculateSchoolYear() - studentGrade + 1;
        const curYear = getCurriculumYear(enrollYear);
        const plannedNames = [
          ...new Set(plans.map((p) => (p.subject as { name?: string } | null)?.name).filter((n): n is string => !!n)),
        ];
        const adequacy = calculateCourseAdequacy(targetMajor, plannedNames, null, curYear);
        if (adequacy) {
          const takenStr = adequacy.taken.length > 0 ? adequacy.taken.slice(0, 5).join(", ") : "없음";
          const notTakenStr = adequacy.notTaken.length > 0 ? adequacy.notTaken.slice(0, 5).join(", ") : "없음";
          courseAdequacyText = `\n\n## 전공 교과 적합도 (수강계획 기준)\n- 이수 예정: ${takenStr}\n- 미이수 예정: ${notTakenStr}\n- 일반교과 이수율: ${Math.round(adequacy.generalRate * 100)}%\n- 진로교과 이수율: ${Math.round(adequacy.careerRate * 100)}%`;
        }
      } catch (_e) {
        // 적합도 계산 실패 시 무시
      }
    }

    // 학생 스토리라인 조회 (있으면 진로 방향 보강)
    let storylineText = "";
    try {
      const { data: storylines } = await supabase
        .from("student_record_storylines")
        .select("title, keywords, career_field")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .limit(3);
      if (storylines && storylines.length > 0) {
        const lines = storylines.map((sl) => `- ${sl.title} [${(sl.keywords ?? []).slice(0, 3).join(", ")}]`);
        storylineText = `\n\n## 설정된 스토리라인\n${lines.join("\n")}`;
      }
    } catch (_e) {
      // 스토리라인 조회 실패 시 무시
    }

    const userPrompt = `# 신입생 예비 진단 요청

## 학생 정보
- 학년: ${studentGrade}학년
- 목표 전공: ${targetMajor ?? "미설정"}

## 수강 계획
${plansText}${courseAdequacyText}${storylineText}

## 분석 요청

이 학생은 아직 생기부 기록이 없는 신입생이거나 기록 입력 전입니다.
수강 계획과 목표 전공을 바탕으로 **예비 진단**을 생성해주세요.

다음 JSON 형식으로만 응답하세요:
\`\`\`json
{
  "overallGrade": "B",
  "recordDirection": "수강 계획 기반 준비 방향",
  "directionStrength": "moderate",
  "directionReasoning": "수강 계획이 진로와 연계된 이유 (1-2문장)",
  "strengths": ["수강 계획에서 파악되는 강점 1", "강점 2"],
  "weaknesses": ["준비가 필요한 영역 1", "영역 2"],
  "improvements": [
    {
      "priority": "높음",
      "area": "[역량영역] 항목명",
      "gap": "현재 상태",
      "action": "구체적 준비 행동",
      "outcome": "기대 결과"
    }
  ],
  "recommendedMajors": ["목표 전공과 유사한 추천 전공 1", "추천 전공 2"],
  "strategyNotes": "전략 메모 (2-3문장)"
}
\`\`\`

규칙:
- overallGrade: A+/A/B+/B/C 중 선택 (기록 없으므로 B 또는 B+ 범위 권장)
- directionStrength: "strong"/"moderate"/"weak" 중 선택
- strengths: 2~4개, 수강 계획에서 관찰 가능한 진로 정합성 중심
- weaknesses: 2~3개, 기록 공백 시 예상되는 보완 필요 영역
- improvements: 1~3개, 당장 준비 가능한 구체적 행동 포함
- recommendedMajors: 목표 전공과 연관된 인접 전공 1~3개
- JSON으로만 응답합니다`;

    const { generateTextWithRateLimit } = await import("@/lib/domains/plan/llm/ai-sdk");
    const { extractJson: extractJsonFn } = await import("../extractJson");

    const result = await generateTextWithRateLimit({
      system: `당신은 입시 컨설턴트 내부 분석 도우미입니다. 학생의 수강 계획을 분석하여 예비 진단을 생성합니다. JSON으로만 응답합니다.`,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "standard",
      temperature: 0.3,
      maxTokens: 4096,
      responseFormat: "json",
    });

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    const parsed = extractJsonFn(result.content) as Partial<ProspectiveDiagnosisResult> | null;
    if (!parsed || !parsed.directionStrength) {
      return { success: false, error: "AI 응답 파싱 실패" };
    }

    // DB 저장
    const currentSchoolYear = calculateSchoolYear();
    const { diagnosisRepo } = await import("../../diagnosis-repository").then(async (m) => ({
      diagnosisRepo: m,
    }));
    await diagnosisRepo.upsertDiagnosis({
      tenant_id: tenantId,
      student_id: studentId,
      school_year: currentSchoolYear,
      overall_grade: parsed.overallGrade ?? "B",
      record_direction: parsed.recordDirection ?? "수강 계획 기반",
      direction_strength: (parsed.directionStrength ?? "moderate") as "strong" | "moderate" | "weak",
      direction_reasoning: parsed.directionReasoning ?? null,
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      improvements: (parsed.improvements ?? []) as unknown as import("@/lib/supabase/database.types").Json,
      recommended_majors: parsed.recommendedMajors ?? [],
      strategy_notes: parsed.strategyNotes ?? "",
      source: "ai",
      status: "draft",
    } as import("../../types").DiagnosisInsert);

    return {
      success: true,
      data: {
        overallGrade: parsed.overallGrade ?? "B",
        recordDirection: parsed.recordDirection ?? "수강 계획 기반",
        directionStrength: (parsed.directionStrength ?? "moderate") as "strong" | "moderate" | "weak",
        directionReasoning: parsed.directionReasoning ?? "",
        strengths: parsed.strengths ?? [],
        weaknesses: parsed.weaknesses ?? [],
        improvements: (parsed.improvements ?? []) as DiagnosisImprovement[],
        recommendedMajors: parsed.recommendedMajors ?? [],
        strategyNotes: parsed.strategyNotes ?? "",
      },
    };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요." };
    }
    return { success: false, error: "예비 진단 생성 중 오류가 발생했습니다." };
  }
}

// P1: buildEdgeSummaryForPrompt는 ../edge-summary.ts로 분리됨 ("use server" 비동기 제약)
