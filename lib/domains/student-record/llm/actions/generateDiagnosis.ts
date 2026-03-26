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

interface DiagnosisGenerationResult {
  overallGrade: string;
  recordDirection: string;
  directionStrength: "strong" | "moderate" | "weak";
  strengths: string[];
  weaknesses: string[];
  recommendedMajors: string[];
  strategyNotes: string;
  warnings?: string[];
}

/** 진단에 전달할 보강 컨텍스트 */
export interface DiagnosisEnrichedContext {
  gradeTrend?: Array<{ grade: number; semester: number; subjectName: string; rankGrade: number }>;
  courseAdequacy?: {
    score: number;
    majorCategory: string;
    taken: string[];
    notTaken: string[];
    generalRate: number;
    careerRate: number;
  } | null;
}

export async function generateAiDiagnosis(
  competencyScores: CompetencyScore[],
  activityTags: ActivityTag[],
  studentInfo?: { targetMajor?: string; schoolName?: string; studentId?: string },
  edgeSummarySection?: string,
  enrichedContext?: DiagnosisEnrichedContext,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gradeTrend = (trendRows ?? [])
        .filter((s: { rank_grade: number | null }) => s.rank_grade != null)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any) => ({
          grade: (s.grade as number) ?? 1,
          semester: (s.semester as number) ?? 1,
          subjectName: (s.subject as { name: string } | null)?.name ?? "",
          rankGrade: s.rank_grade as number,
        }));

      // 교과이수적합도
      let courseAdequacy: DiagnosisEnrichedContext["courseAdequacy"] = null;
      if (studentInfo.targetMajor) {
        const { calculateCourseAdequacy } = await import("../../course-adequacy");
        const { calculateSchoolYear } = await import("@/lib/utils/schoolYear");
        const { data: student } = await supabase
          .from("students")
          .select("grade")
          .eq("id", studentInfo.studentId)
          .maybeSingle();
        const studentGrade = (student?.grade as number) ?? 3;
        const enrollYear = calculateSchoolYear() - studentGrade + 1;
        const curYear = enrollYear >= 2025 ? 2022 : 2015;
        const takenNames = [...new Set(gradeTrend.map((s: { subjectName: string }) => s.subjectName))];
        const result = calculateCourseAdequacy(studentInfo.targetMajor, takenNames, null, curYear);
        if (result) {
          courseAdequacy = {
            score: result.score,
            majorCategory: result.majorCategory,
            taken: result.taken,
            notTaken: result.notTaken,
            generalRate: result.generalRate,
            careerRate: result.careerRate,
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
            line += `\n    Q${qi}. ${questions[qi]} → ${r.grade} ("${r.reasoning.slice(0, 50)}")`;
          } else {
            line += `\n    Q${qi}. ${questions[qi]} → ⚠ 근거없음`;
            rubricGaps.push(`${item.label} Q${qi}: "${questions[qi]}"`);
          }
        }
      }

      return line;
    }).join("\n");

    // ── 활동 태그 요약 — 레코드 유형별 분류 ──
    type TagItemStats = { positive: number; negative: number; needs_review: number; byType: Map<string, number>; samples: string[] };
    const tagsByItem = new Map<string, TagItemStats>();
    for (const t of activityTags) {
      const key = t.competency_item;
      const entry: TagItemStats = tagsByItem.get(key) ?? { positive: 0, negative: 0, needs_review: 0, byType: new Map(), samples: [] as string[] };
      if (t.evaluation === "positive") entry.positive++;
      else if (t.evaluation === "negative") entry.negative++;
      else entry.needs_review++;
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
        // 레코드 유형별 분포
        const typeBreakdown = [...stats.byType.entries()].map(([type, cnt]) => `${type} ${cnt}`).join(", ");
        const samples = stats.samples.length > 0 ? `\n    예: ${stats.samples.join("; ")}` : "";
        return `  - ${label}: ${counts} (${typeBreakdown})${samples}`;
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
      adequacySection = `\n## 교과이수적합도
  · 목표전공: ${ca.majorCategory} / 이수율: ${ca.score}%
  · 일반선택 ${ca.generalRate}% / 진로선택 ${ca.careerRate}%
  · 이수 완료: ${ca.taken.join(", ") || "없음"}
  · 미이수 추천: ${ca.notTaken.join(", ") || "없음"}`;
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
4. strengths: 강점 3~5개 (구체적 루브릭 질문 근거 포함)
5. weaknesses: 약점 2~4개 (루브릭 갭 + 개선 방향 포함)
6. recommendedMajors: 추천 전공 2~3개 (다음 중 선택: ${MAJOR_LIST})
7. strategyNotes: 전략 메모 (100자 이내)

## 규칙
- **루브릭 질문별 등급**을 최우선 근거로 활용하세요. 항목 종합 등급만이 아닌 질문 단위로 강점/약점을 판단합니다.
- **"근거없음"** 표시된 루브릭 질문은 약점 또는 보완 필요 영역으로 반영하세요.
- 성적 추이가 제공되면 academic_achievement Q3 (학기별 추이) 평가에 활용하세요.
- 교과이수적합도가 제공되면 career 역량 진단에 반영하세요.
- 긍정 태그가 많아도 needs_review가 다수면 깊이 부족으로 판단하세요.
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

    const result = await generateTextWithRateLimit({
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "fast",
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
    const emptyStrengths = !Array.isArray(parsed.strengths) || parsed.strengths.length === 0;
    const emptyWeaknesses = !Array.isArray(parsed.weaknesses) || parsed.weaknesses.length === 0;

    const warnings: string[] = [];
    if (gradeFallback) warnings.push("종합등급이 기본값(B)으로 설정되었습니다");
    if (strengthFallback) warnings.push("방향 강도가 기본값(보통)으로 설정되었습니다");
    if (emptyStrengths) warnings.push("강점 항목이 추출되지 않았습니다");
    if (emptyWeaknesses) warnings.push("약점 항목이 추출되지 않았습니다");

    if (warnings.length > 0) {
      logActionWarn(LOG_CTX, "AI 진단 응답에 fallback 적용", {
        gradeFallback: gradeFallback ? `"${String(parsed.overallGrade)}" → "B"` : null,
        strengthFallback: strengthFallback ? `"${String(parsed.directionStrength)}" → "moderate"` : null,
        emptyStrengths, emptyWeaknesses,
      });
    }

    return {
      success: true,
      data: {
        overallGrade: !gradeFallback ? (parsed.overallGrade as string) : "B",
        recordDirection: String(parsed.recordDirection ?? "").slice(0, 50),
        directionStrength: !strengthFallback ? (parsed.directionStrength as "strong" | "moderate" | "weak") : "moderate",
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((s): s is string => typeof s === "string" && s.length > 0) : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter((s): s is string => typeof s === "string" && s.length > 0) : [],
        recommendedMajors: Array.isArray(parsed.recommendedMajors) ? parsed.recommendedMajors.filter((s): s is string => typeof s === "string" && s.length > 0) : [],
        strategyNotes: String(parsed.strategyNotes ?? ""),
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
