// ============================================
// AI 진단 헬퍼 함수들
// generateDiagnosis.ts에서 추출한 데이터 준비/변환/fallback 헬퍼
// ============================================

import { logActionWarn } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "../ai-client";
import { extractJson } from "../extractJson";
import { withRetry } from "../retry";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "../../constants";
import type { CompetencyScore } from "../../types";
import type { TagItemStats } from "../prompts/diagnosisPrompt";

// ── 공유 타입 정의 (generateDiagnosis.ts와 순환 참조 방지를 위해 여기서 정의) ──

export interface DiagnosisImprovement {
  priority: "높음" | "중간" | "낮음";
  area: string;
  gap: string;
  action: string;
  outcome: string;
}

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

export interface CoursePlanContext {
  studentId: string;
  tenantId: string;
  coursePlanData: import("../../course-plan/types").CoursePlanTabData | null;
  snapshot: Record<string, unknown> | null;
}

const LOG_CTX = { domain: "student-record", action: "generateDiagnosis" };

// ── 약한 등급 판단 기준 ──
const LOW_GRADE_THRESHOLD = new Set(["B+", "B", "B-", "C"]);

// ── 개선 제안 매핑 ──
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

// ── 강점 등급 판단 기준 ──
const HIGH_GRADES = new Set(["A+", "A-"]);

/** 루브릭 등급 + 태그 기반으로 강점 자동 생성 */
export function generateStrengthsFallback(
  scores: CompetencyScore[],
  tagsByItem: Map<string, TagItemStats>,
): string[] {
  const results: string[] = [];

  // 컨설턴트 > AI 우선, 높은 등급 항목만
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
    if (!HIGH_GRADES.has(grade)) continue;

    const item = COMPETENCY_ITEMS.find((i) => i.code === sc.competency_item);
    if (!item) continue;

    const area = COMPETENCY_AREA_LABELS[item.area];
    const tags = tagsByItem.get(sc.competency_item);
    const posCount = tags?.positive ?? 0;

    // 루브릭 상위 비율 계산
    const rubrics = Array.isArray(sc.rubric_scores) ? sc.rubric_scores as Array<{ grade: string }> : [];
    const topCount = rubrics.filter((r) => HIGH_GRADES.has(r.grade)).length;
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
export function generateWeaknessesFallback(
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
    if (!LOW_GRADE_THRESHOLD.has(grade)) continue;

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
export function parseImprovements(raw: unknown): DiagnosisImprovement[] {
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
export function generateImprovementsFallback(
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
// 수강계획 기반 예비 진단 — 내부 헬퍼
// (generateAiDiagnosis가 scores/tags 0건일 때 자동 호출)
// ============================================

import type { DiagnosisGenerationResult } from "./generateDiagnosis";

/**
 * 수강계획+진로 기반 예비 진단 생성 (내부 헬퍼).
 * DB 저장은 호출자(pipeline-task-runners / pipeline.ts)가 수행한다.
 */
export async function generateProspectiveDiagnosisInternal(
  ctx: CoursePlanContext,
): Promise<{ success: true; data: DiagnosisGenerationResult } | { success: false; error: string }> {
  const { studentId, tenantId, coursePlanData, snapshot } = ctx;

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
    } catch (e) {
      // 적합도 계산 실패 — 보조 데이터이므로 경미 로깅만
      logActionWarn(LOG_CTX, "전공 교과 적합도 계산 실패", { studentId, error: String(e) });
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
  } catch (e) {
    // 스토리라인 조회 실패 — 보조 데이터이므로 경미 로깅만
    logActionWarn(LOG_CTX, "스토리라인 조회 실패", { studentId, error: String(e) });
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

  const result = await withRetry(
    () => generateTextWithRateLimit({
      system: `당신은 입시 컨설턴트 내부 분석 도우미입니다. 학생의 수강 계획을 분석하여 예비 진단을 생성합니다. JSON으로만 응답합니다.`,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "standard",
      temperature: 0.3,
      maxTokens: 4096,
      responseFormat: "json",
    }),
    { label: "generateProspectiveDiagnosis" },
  );

  if (!result.content) {
    return { success: false, error: "AI 응답이 비어있습니다." };
  }

  type ProspectiveParsed = {
    overallGrade?: string;
    recordDirection?: string;
    directionStrength?: string;
    directionReasoning?: string;
    strengths?: string[];
    weaknesses?: string[];
    improvements?: unknown[];
    recommendedMajors?: string[];
    strategyNotes?: string;
  };
  const parsed = extractJson<ProspectiveParsed>(result.content);
  if (!parsed || !parsed.directionStrength) {
    return { success: false, error: "AI 응답 파싱 실패" };
  }

  const validStrengths = new Set(["strong", "moderate", "weak"]);
  const directionStrength = validStrengths.has(parsed.directionStrength)
    ? (parsed.directionStrength as "strong" | "moderate" | "weak")
    : "moderate";

  return {
    success: true,
    data: {
      overallGrade: parsed.overallGrade ?? "B",
      recordDirection: parsed.recordDirection ?? "수강 계획 기반",
      directionStrength,
      directionReasoning: parsed.directionReasoning ?? "",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((s): s is string => typeof s === "string") : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter((s): s is string => typeof s === "string") : [],
      improvements: parseImprovements(parsed.improvements),
      recommendedMajors: Array.isArray(parsed.recommendedMajors) ? parsed.recommendedMajors.filter((s): s is string => typeof s === "string") : [],
      strategyNotes: parsed.strategyNotes ?? "",
    },
  };
}
