// ============================================
// report-transform.ts — 타입, 상수, 데이터 변환
// ============================================

import type { ReportData } from "../actions";
import { COMPETENCY_ITEMS } from "../../constants";

// ============================================
// 상수 (라벨 매핑)
// ============================================

export const EDGE_TYPE_LABELS: Record<string, string> = {
  COMPETENCY_SHARED: "역량 공유",
  CONTENT_REFERENCE: "내용 참조",
  TEMPORAL_GROWTH: "시간적 성장",
  COURSE_SUPPORTS: "교과 지원",
  READING_ENRICHES: "독서 심화",
  THEME_CONVERGENCE: "주제 수렴",
  TEACHER_VALIDATION: "교사 검증",
};

export const AREA_LABELS: Record<string, string> = {
  autonomy: "자율·자치", club: "동아리", career: "진로",
  setek: "세특", personal_setek: "개인세특", reading: "독서",
  course_selection: "교과선택", competition: "대회", external: "외부활동",
  volunteer: "봉사", general: "기타",
};

export const SECTION_LABELS: Record<string, string> = {
  intro: "소개",
  subject_setek: "교과 학습 활동",
  personal_setek: "개인 탐구 활동",
  changche: "창의적 체험활동",
  reading: "독서 활동",
  haengteuk: "학교생활 및 인성",
  growth: "종합 성장 요약",
};

// ============================================
// 타입 정의
// ============================================

/** 내보내기용 섹션 (ActivitySummarySection보다 유연) */
export interface ExportSection {
  sectionType: string;
  title: string;
  content: string;
  relatedSubjects?: string[];
}

export interface ReportExportData {
  title: string;
  studentName: string;
  targetGrades: number[];
  createdAt: string;
  /** Phase V1: 파이프라인 실행 모드 */
  mode?: "analysis" | "prospective";
  /** AI 생성 섹션 */
  sections: ExportSection[];
  /** 수동 편집 텍스트 (있으면 sections 대신 사용) */
  editedText?: string | null;

  // Phase F4: 종합 리포트 확장 필드 (optional)
  diagnosis?: {
    overallGrade: string;
    recordDirection: string;
    directionStrength?: string;
    directionReasoning?: string;
    strengths: string[];
    weaknesses: string[];
    improvements?: Array<{ priority: string; area: string; gap?: string; action: string; outcome?: string }>;
    recommendedMajors: string[];
    strategyNotes?: string;
  } | null;
  competencyScores?: Array<{
    area: string;
    label: string;
    grade: string;
  }> | null;
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
  strategies?: Array<{
    targetArea: string;
    content: string;
    priority: string;
  }> | null;
  mockAnalysis?: {
    recentExamTitle: string;
    recentExamDate: string;
    avgPercentile: number | null;
    totalStdScore: number | null;
    best3GradeSum: number | null;
  } | null;
  edgeSummary?: {
    totalEdges: number;
    byType: Array<{ type: string; count: number; example?: string }>;
  } | null;
  roadmapItems?: Array<{
    grade: number;
    semester: number | null;
    area: string;
    plan_content: string;
    status: string;
    storylineTitle?: string;
  }> | null;
  interviewQuestions?: Array<{
    question: string;
    questionType: string;
    difficulty: string;
    suggestedAnswer: string | null;
  }> | null;
  // Part 6: 3년 구조 확장 필드
  changcheGuides?: Array<{
    activityType: string;
    direction: string;
    keywords: string[];
    competencyFocus: string[];
  }> | null;
  haengteukGuide?: {
    direction: string;
    keywords: string[];
    competencyFocus: string[];
    evaluationItems?: Array<{ item: string; score: string; reasoning: string }>;
  } | null;
  coursePlansByGrade?: Record<number, Array<{
    subjectName: string;
    subjectType: string | null;
    status: string;
    reason: string | null;
  }>> | null;
  actionItems?: Array<{
    area: string;
    content: string;
    status: string;
    grade: number;
    semester: number | null;
  }> | null;
  univStrategies?: Array<{
    universityName: string;
    admissionType: string;
    evaluationFactors: Record<string, number> | null;
    keyTips: string[] | null;
  }> | null;

  // Phase P3: 파이프라인 Eval 확장 필드
  executiveSummary?: {
    overallScore: number;
    overallGrade: string;
    growthTrend?: string;
    topStrengths: Array<{ name: string; score: number }>;
    topWeaknesses: Array<{ name: string; score: number }>;
    narrative: string;
  } | null;
  timeSeriesAnalysis?: {
    overallGrowthRate: number;
    strongestName: string;
    weakestName: string;
    anomalyCount: number;
    summary: string;
  } | null;
  universityMatch?: {
    topMatch: { label: string; grade: string; score: number; recommendation: string };
    matches: Array<{ label: string; grade: string; score: number }>;
    summary: string;
  } | null;
  contentQualityDetail?: Array<{
    recordType: string;
    overallScore: number;
    issues: string[];
    feedback: string | null;
  }> | null;

  /** 설계 모드 예상 분석 (P7/P8 가안 기반) */
  projectedAnalysis?: {
    designGrades: number[];
    levelLabel: string;
    gap: number;
    tierLabel: string;
    projectedCompetencyCount: number;
    projectedEdgeCount: number;
  } | null;
}

// ============================================
// ReportData → ReportExportData 변환
// ============================================

/** ReportData(뷰어 전체 데이터)를 ReportExportData(PDF/Word 내보내기)로 변환 */
export function buildReportExportData(data: ReportData): ReportExportData {
  // 진단 (AI 우선, 없으면 컨설턴트)
  const diag = data.diagnosisData.aiDiagnosis ?? data.diagnosisData.consultantDiagnosis;

  // 역량 등급 (AI 우선)
  const scores = data.diagnosisData.competencyScores.ai.length > 0
    ? data.diagnosisData.competencyScores.ai
    : data.diagnosisData.competencyScores.consultant;

  const competencyScores = scores.map((s) => {
    const item = COMPETENCY_ITEMS.find((c) => c.code === s.competency_item);
    return {
      area: item?.area ?? s.competency_area,
      label: item?.label ?? s.competency_item,
      grade: s.grade_value,
    };
  });

  // 교과 이수 적합도
  const ca = data.diagnosisData.courseAdequacy;

  // 보완 전략
  const strategies = data.diagnosisData.strategies
    .filter((s) => s.status !== "done")
    .map((s) => ({
      targetArea: s.target_area,
      content: s.strategy_content,
      priority: s.priority ?? "medium",
    }));

  // 모의고사
  const ma = data.mockAnalysis;
  const mockAnalysis = ma.recentExam ? {
    recentExamTitle: ma.recentExam.examTitle,
    recentExamDate: ma.recentExam.examDate,
    avgPercentile: ma.avgPercentile,
    totalStdScore: ma.totalStdScore,
    best3GradeSum: ma.best3GradeSum,
  } : null;

  // 활동 요약서 섹션 (가장 최신 approved/draft)
  const latestSummary = data.activitySummaries
    .filter((s) => s.status === "approved" || s.status === "draft")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  let sections: ExportSection[] = [];
  if (latestSummary) {
    const parsed = latestSummary.summary_sections;
    if (Array.isArray(parsed)) {
      sections = (parsed as Array<{ sectionType?: string; title?: string; content?: string; relatedSubjects?: string[] }>)
        .filter((s) => s.sectionType && s.content)
        .map((s) => ({
          sectionType: s.sectionType!,
          title: SECTION_LABELS[s.sectionType!] ?? s.title ?? s.sectionType!,
          content: s.content!,
          relatedSubjects: s.relatedSubjects,
        }));
    }
    if (sections.length === 0 && latestSummary.summary_text) {
      sections = [{ sectionType: "growth", title: "종합 요약", content: latestSummary.summary_text }];
    }
  }

  // Phase V1: 파이프라인 mode 추출
  const pipelineMode = data.pipelineMeta?.mode ?? undefined;

  return {
    title: "수시 종합 리포트",
    studentName: data.student.name ?? "학생",
    targetGrades: [1, 2, 3].filter((g) => g <= data.student.grade),
    createdAt: data.generatedAt,
    mode: pipelineMode,
    sections,
    editedText: latestSummary?.edited_text ?? null,
    diagnosis: diag ? {
      overallGrade: diag.overall_grade,
      recordDirection: diag.record_direction ?? "",
      directionStrength: diag.direction_strength ?? undefined,
      directionReasoning: diag.direction_reasoning ?? undefined,
      strengths: diag.strengths ?? [],
      weaknesses: diag.weaknesses ?? [],
      improvements: Array.isArray(diag.improvements)
        ? (diag.improvements as Array<{ priority: string; area: string; gap?: string; action: string; outcome?: string }>)
        : undefined,
      recommendedMajors: diag.recommended_majors ?? [],
      strategyNotes: diag.strategy_notes ?? undefined,
    } : null,
    competencyScores: competencyScores.length > 0 ? competencyScores : null,
    courseAdequacy: ca ? {
      score: ca.score,
      majorCategory: ca.majorCategory,
      taken: ca.taken,
      notTaken: ca.notTaken,
      notOffered: ca.notOffered,
      generalRate: ca.generalRate,
      careerRate: ca.careerRate,
      fusionRate: ca.fusionRate,
    } : null,
    strategies: strategies.length > 0 ? strategies : null,
    mockAnalysis,
    edgeSummary: buildEdgeSummaryForExport(data.edges),
    roadmapItems: buildRoadmapForExport(data.storylineData.roadmapItems, data.storylineData.storylines),
    interviewQuestions: data.interviewQuestions.length > 0
      ? data.interviewQuestions.map((q) => ({
          question: q.question,
          questionType: q.question_type,
          difficulty: q.difficulty,
          suggestedAnswer: q.suggested_answer,
        }))
      : null,
    // Part 6: 3년 구조 확장 매핑
    changcheGuides: data.changcheGuides.length > 0
      ? data.changcheGuides.map((g) => ({
          activityType: g.activity_type,
          direction: g.direction,
          keywords: g.keywords,
          competencyFocus: g.competency_focus,
        }))
      : null,
    haengteukGuide: data.haengteukGuides.length > 0
      ? (() => {
          const latest = data.haengteukGuides.sort(
            (a, b) => b.created_at.localeCompare(a.created_at),
          )[0];
          const evalItems = Array.isArray(latest.evaluation_items)
            ? (latest.evaluation_items as Array<{ item: string; score: string; reasoning: string }>)
            : [];
          return {
            direction: latest.direction,
            keywords: latest.keywords,
            competencyFocus: latest.competency_focus,
            evaluationItems: evalItems.length > 0 ? evalItems : undefined,
          };
        })()
      : null,
    coursePlansByGrade: data.coursePlans.length > 0
      ? data.coursePlans.reduce<Record<number, Array<{ subjectName: string; subjectType: string | null; status: string; reason: string | null }>>>(
          (acc, p) => {
            if (!acc[p.grade]) acc[p.grade] = [];
            acc[p.grade].push({
              subjectName: p.subject?.name ?? p.subject_id,
              subjectType: p.subject?.subject_type?.name ?? null,
              status: p.plan_status,
              reason: p.recommendation_reason,
            });
            return acc;
          },
          {},
        )
      : null,
    actionItems: (() => {
      const currentMonth = new Date().getMonth() + 1;
      const currentSemester = currentMonth >= 3 && currentMonth <= 8 ? 1 : 2;
      const thisTermItems = data.storylineData.roadmapItems.filter(
        (item) =>
          item.grade === data.student.grade &&
          (item.semester === currentSemester || item.semester === null) &&
          item.status !== "completed",
      );
      return thisTermItems.length > 0
        ? thisTermItems.map((item) => ({
            area: item.area,
            content: item.plan_content,
            status: item.status ?? "planning",
            grade: item.grade,
            semester: item.semester,
          }))
        : null;
    })(),
    univStrategies: data.univStrategies.length > 0
      ? data.univStrategies.map((s) => ({
          universityName: s.university_name,
          admissionType: s.admission_type,
          evaluationFactors: s.evaluation_factors,
          keyTips: s.key_tips,
        }))
      : null,

    // Phase P3: 파이프라인 Eval 확장
    executiveSummary: data.executiveSummary ? {
      overallScore: data.executiveSummary.overallScore,
      overallGrade: data.executiveSummary.overallGrade,
      growthTrend: data.executiveSummary.growthTrend,
      topStrengths: data.executiveSummary.topStrengths.map((s) => ({
        name: s.competencyName,
        score: s.score,
      })),
      topWeaknesses: data.executiveSummary.topWeaknesses.map((s) => ({
        name: s.competencyName,
        score: s.score,
      })),
      narrative: data.executiveSummary.narrative,
    } : null,

    timeSeriesAnalysis: (() => {
      const ts = data.timeSeriesAnalysis;
      if (!ts) return null;
      return {
        overallGrowthRate: ts.overallGrowthRate,
        strongestName: ts.trends.find((t) => t.competencyId === ts.strongestCompetency)?.competencyName ?? "",
        weakestName: ts.trends.find((t) => t.competencyId === ts.weakestCompetency)?.competencyName ?? "",
        anomalyCount: ts.anomalies.length,
        summary: ts.summary,
      };
    })(),

    universityMatch: data.universityMatch ? {
      topMatch: {
        label: data.universityMatch.topMatch.label,
        grade: data.universityMatch.topMatch.grade,
        score: data.universityMatch.topMatch.matchScore,
        recommendation: data.universityMatch.topMatch.recommendation,
      },
      matches: data.universityMatch.matches.map((m) => ({
        label: m.label,
        grade: m.grade,
        score: m.matchScore,
      })),
      summary: data.universityMatch.summary,
    } : null,

    contentQualityDetail: data.contentQuality.length > 0
      ? data.contentQuality.map((q) => ({
          recordType: q.record_type,
          overallScore: q.overall_score,
          issues: q.issues,
          feedback: q.feedback,
        }))
      : null,

    projectedAnalysis: data.projectedData ? {
      designGrades: data.projectedData.designGrades,
      levelLabel: data.projectedData.leveling?.levelLabel ?? "",
      gap: data.projectedData.leveling?.gap ?? 0,
      tierLabel: data.projectedData.leveling?.tierLabel ?? "",
      projectedCompetencyCount: data.projectedData.competencyScores.length,
      projectedEdgeCount: data.projectedData.edges.length,
    } : null,
  };
}

export function buildRoadmapForExport(
  items: ReportData["storylineData"]["roadmapItems"],
  storylines: ReportData["storylineData"]["storylines"],
): ReportExportData["roadmapItems"] {
  if (!items || items.length === 0) return null;
  const storylineMap = new Map(storylines.map((s) => [s.id, s.title]));
  return items
    .sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return (a.semester ?? 3) - (b.semester ?? 3); // null semester → 학년 끝으로 정렬
    })
    .map((item) => ({
      grade: item.grade,
      semester: item.semester,
      area: item.area,
      plan_content: item.plan_content,
      status: item.status ?? "planning",
      storylineTitle: item.storyline_id ? storylineMap.get(item.storyline_id) ?? undefined : undefined,
    }));
}

export function buildEdgeSummaryForExport(
  edges: ReportData["edges"],
): ReportExportData["edgeSummary"] {
  if (!edges || edges.length === 0) return null;
  const byType = new Map<string, { count: number; example?: string }>();
  for (const e of edges) {
    const existing = byType.get(e.edge_type) ?? { count: 0 };
    existing.count++;
    if (!existing.example && e.reason) existing.example = e.reason;
    byType.set(e.edge_type, existing);
  }
  return {
    totalEdges: edges.length,
    byType: Array.from(byType.entries()).map(([type, v]) => ({
      type,
      count: v.count,
      example: v.example,
    })),
  };
}
