// ============================================
// Unified Grade Input Builder
//
// Synthesis Pipeline이 학년별 데이터를 소비하기 위한 통합 레이어.
// Grade Pipeline 완료 후 1회 호출하여 ctx.unifiedInput에 저장.
//
// 분석 학년(NEIS): 역량점수 + 활동태그 + 품질점수 + 원본레코드 + 방향가이드
// 설계 학년(no NEIS): 방향가이드 + 수강계획 + 슬롯(빈 레코드)
//
// 가상 레코드: 설계 학년의 방향 가이드를 기존 입력 형식으로 변환하여
//             LLM 함수 시그니처 변경 없이 Synthesis 태스크에 공급.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecordSummary } from "./llm/prompts/inquiryLinking";
import { logActionDebug } from "@/lib/logging/actionLogger";
import { PIPELINE_THRESHOLDS } from "./constants";
import { findContentQualityByStudent } from "./competency-repository";

const LOG_CTX = { domain: "student-record", action: "unified-input" };

// ============================================
// 타입 정의
// ============================================

/** 방향 가이드 요약 (세특/창체/행특 공통) */
export interface DirectionGuideSummary {
  id: string;
  type: "setek" | "changche" | "haengteuk";
  grade: number;
  schoolYear: number;
  subjectName?: string;
  activityType?: string;
  direction: string;
  keywords: string[];
  competencyFocus: string[];
  teacherPoints: string[];
}

/** 학년 레코드 콘텐츠 (분석/설계 공통) */
export interface GradeRecordContent {
  id: string;
  recordType: "setek" | "changche" | "haengteuk";
  grade: number;
  subjectName?: string;
  activityType?: string;
  content: string;
  hasNeis: boolean;
}

/** 수강계획 요약 */
export interface CoursePlanSummary {
  grade: number;
  semester: number;
  subjectName: string;
  subjectType?: string;
  planStatus: string;
}

/** 역량점수 행 */
export interface UnifiedCompetencyScore {
  competencyItem: string;
  gradeValue: string;
  schoolYear: number;
}

/** 활동태그 행 */
export interface UnifiedActivityTag {
  recordId: string;
  recordType: string;
  competencyItem: string;
  evaluation: string;
  evidenceSummary?: string;
  /** 설계 학년의 가상 태그인 경우 true */
  isVirtual?: boolean;
}

/** 품질점수 행 */
export interface UnifiedContentQuality {
  recordId: string;
  recordType: string;
  overallScore: number;
  issues: string[];
  feedback: string;
}

// ─── 학년별 출력 계약 (S3) ───

export interface AnalysisGradeOutput {
  mode: "analysis";
  grade: number;
  competencyScores: UnifiedCompetencyScore[];
  activityTags: UnifiedActivityTag[];
  contentQuality: UnifiedContentQuality[];
  directionGuides: DirectionGuideSummary[];
  records: GradeRecordContent[];
}

export interface DesignGradeOutput {
  mode: "design";
  grade: number;
  competencyScores: [];
  activityTags: [];
  contentQuality: [];
  directionGuides: DirectionGuideSummary[];
  records: GradeRecordContent[];
  coursePlans: CoursePlanSummary[];
}

export type GradeOutput = AnalysisGradeOutput | DesignGradeOutput;

/** Synthesis Pipeline 전체 태스크가 공유하는 통합 입력 */
export interface UnifiedGradeInput {
  grades: Record<number, GradeOutput>;
  analysisGrades: number[];
  designGrades: number[];
  hasAnyAnalysis: boolean;
  hasAnyDesign: boolean;
  isHybrid: boolean;
}

// ============================================
// 빌더
// ============================================

export async function buildUnifiedGradeInput(params: {
  studentId: string;
  tenantId: string;
  studentGrade: number;
  supabase: SupabaseClient;
}): Promise<UnifiedGradeInput> {
  const { studentId, tenantId, studentGrade, supabase } = params;
  const { calculateSchoolYear } = await import("@/lib/utils/schoolYear");
  const currentSchoolYear = calculateSchoolYear();

  // 1. 완료된 Grade Pipeline 행에서 학년별 mode 조회
  const { data: pipelines } = await supabase
    .from("student_record_analysis_pipelines")
    .select("grade, mode, status")
    .eq("student_id", studentId)
    .eq("pipeline_type", "grade")
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const gradeMode = new Map<number, "analysis" | "design">();
  for (const row of pipelines ?? []) {
    if (row.grade != null && !gradeMode.has(row.grade as number)) {
      gradeMode.set(row.grade as number, row.mode === "design" ? "design" : "analysis");
    }
  }

  const analysisGrades = [...gradeMode.entries()].filter(([, m]) => m === "analysis").map(([g]) => g).sort();
  const designGrades = [...gradeMode.entries()].filter(([, m]) => m === "design").map(([g]) => g).sort();
  const allGrades = [...analysisGrades, ...designGrades].sort();

  // 2. 공통 데이터 병렬 조회
  const [seteksRes, changcheRes, haengteukRes, guidesSetekRes, guidesChangcheRes, guidesHaengteukRes, coursePlansRes] = await Promise.all([
    supabase.from("student_record_seteks")
      .select("id, content, confirmed_content, imported_content, ai_draft_content, grade, subject:subject_id(name)")
      .eq("student_id", studentId).eq("tenant_id", tenantId).is("deleted_at", null),
    supabase.from("student_record_changche")
      .select("id, content, confirmed_content, imported_content, ai_draft_content, grade, activity_type")
      .eq("student_id", studentId).eq("tenant_id", tenantId),
    supabase.from("student_record_haengteuk")
      .select("id, content, confirmed_content, imported_content, ai_draft_content, grade")
      .eq("student_id", studentId).eq("tenant_id", tenantId),
    supabase.from("student_record_setek_guides")
      .select("id, school_year, direction, keywords, competency_focus, teacher_points, subject:subject_id(name)")
      .eq("student_id", studentId).eq("tenant_id", tenantId).eq("source", "ai"),
    supabase.from("student_record_changche_guides")
      .select("id, school_year, activity_type, direction, keywords, competency_focus, teacher_points")
      .eq("student_id", studentId).eq("tenant_id", tenantId).eq("source", "ai"),
    supabase.from("student_record_haengteuk_guides")
      .select("id, school_year, direction, keywords, competency_focus, teacher_points")
      .eq("student_id", studentId).eq("tenant_id", tenantId).eq("source", "ai"),
    supabase.from("student_course_plans")
      .select("grade, semester, plan_status, subject:subject_id(name, subject_type:subject_type_id(name))")
      .eq("student_id", studentId).in("plan_status", ["confirmed", "recommended"]),
  ]);

  // 분석 학년 전용: 역량점수 + 태그 + 품질
  let scoresRes: { data: unknown[] | null } = { data: null };
  let tagsRes: { data: unknown[] | null } = { data: null };
  let qualityRes: { data: unknown[] | null } = { data: null };

  if (analysisGrades.length > 0) {
    const [scoresRaw, tagsRaw, qualityRaw] = await Promise.all([
      supabase.from("student_record_competency_scores")
        .select("competency_item, grade_value, school_year")
        .eq("student_id", studentId).eq("tenant_id", tenantId),
      supabase.from("student_record_activity_tags")
        .select("record_id, record_type, competency_item, evaluation, evidence_summary, tag_context")
        .eq("student_id", studentId).eq("tenant_id", tenantId).eq("source", "ai")
        .or("tag_context.eq.analysis,tag_context.is.null"),  // draft_analysis 제외
      findContentQualityByStudent(studentId, tenantId, { source: "ai", selectRecordId: true }),
    ]);
    scoresRes = scoresRaw;
    tagsRes = tagsRaw;
    qualityRes = { data: qualityRaw };
  }

  // 3. 학년별 school_year 매핑
  const schoolYearForGrade = (grade: number) => currentSchoolYear - studentGrade + grade;

  // 4. 가이드를 학년별로 그룹핑
  type GuideRow = { id: string; school_year: number; direction: string | null; keywords: string[] | null; competency_focus: string[] | null; teacher_points: string[] | null; subject?: { name: string } | null; activity_type?: string | null };
  const groupGuidesByGrade = (rows: GuideRow[] | null, type: "setek" | "changche" | "haengteuk"): Map<number, DirectionGuideSummary[]> => {
    const map = new Map<number, DirectionGuideSummary[]>();
    for (const r of rows ?? []) {
      const grade = Math.min(3, Math.max(1, r.school_year - currentSchoolYear + studentGrade));
      if (!map.has(grade)) map.set(grade, []);
      map.get(grade)!.push({
        id: r.id,
        type,
        grade,
        schoolYear: r.school_year,
        subjectName: (r as { subject?: { name: string } | null }).subject?.name,
        activityType: r.activity_type ?? undefined,
        direction: r.direction ?? "",
        keywords: r.keywords ?? [],
        competencyFocus: r.competency_focus ?? [],
        teacherPoints: r.teacher_points ?? [],
      });
    }
    return map;
  };

  const setekGuidesByGrade = groupGuidesByGrade(guidesSetekRes.data as GuideRow[] | null, "setek");
  const changcheGuidesByGrade = groupGuidesByGrade(guidesChangcheRes.data as GuideRow[] | null, "changche");
  const haengteukGuidesByGrade = groupGuidesByGrade(guidesHaengteukRes.data as GuideRow[] | null, "haengteuk");

  // 5. 레코드를 학년별로 그룹핑 + effectiveContent 해소
  //    콘텐츠 우선순위: imported_content(NEIS) > confirmed_content(확정본) > content(가안) > ai_draft_content(P7 가안)
  type SetekRow = { id: string; content: string; confirmed_content: string | null; imported_content: string | null; ai_draft_content: string | null; grade: number; subject: { name: string } | null };
  type ChangcheRow = { id: string; content: string; confirmed_content: string | null; imported_content: string | null; ai_draft_content: string | null; grade: number; activity_type: string | null };
  type HaengteukRow = { id: string; content: string; confirmed_content: string | null; imported_content: string | null; ai_draft_content: string | null; grade: number };

  function resolveContent(imported: string | null | undefined, confirmed: string | null | undefined, content: string | null | undefined, aiDraft: string | null | undefined): { text: string; hasNeis: boolean } {
    const imp = imported?.trim();
    if (imp && imp.length > PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH) return { text: imp, hasNeis: true };
    const conf = confirmed?.trim();
    if (conf && conf.length > PIPELINE_THRESHOLDS.MIN_CONTENT_LENGTH) return { text: conf, hasNeis: false };
    const con = content?.trim();
    if (con && con.length > PIPELINE_THRESHOLDS.MIN_CONTENT_LENGTH) return { text: con, hasNeis: false };
    const draft = aiDraft?.trim();
    if (draft && draft.length > PIPELINE_THRESHOLDS.MIN_CONTENT_LENGTH) return { text: draft, hasNeis: false };
    return { text: "", hasNeis: false };
  }

  const buildRecords = (grade: number): GradeRecordContent[] => {
    const recs: GradeRecordContent[] = [];
    for (const s of (seteksRes.data ?? []) as SetekRow[]) {
      if (s.grade !== grade) continue;
      const { text: content, hasNeis } = resolveContent(s.imported_content, s.confirmed_content, s.content, s.ai_draft_content);
      if (content.length < PIPELINE_THRESHOLDS.MIN_CONTENT_LENGTH) continue;
      recs.push({ id: s.id, recordType: "setek", grade, subjectName: s.subject?.name, content, hasNeis });
    }
    for (const c of (changcheRes.data ?? []) as ChangcheRow[]) {
      if (c.grade !== grade) continue;
      const { text: content, hasNeis } = resolveContent(c.imported_content, c.confirmed_content, c.content, c.ai_draft_content);
      if (content.length < PIPELINE_THRESHOLDS.MIN_CONTENT_LENGTH) continue;
      recs.push({ id: c.id, recordType: "changche", grade, activityType: c.activity_type ?? undefined, content, hasNeis });
    }
    for (const h of (haengteukRes.data ?? []) as HaengteukRow[]) {
      if (h.grade !== grade) continue;
      const { text: content, hasNeis } = resolveContent(h.imported_content, h.confirmed_content, h.content, h.ai_draft_content);
      if (content.length < PIPELINE_THRESHOLDS.MIN_CONTENT_LENGTH) continue;
      recs.push({ id: h.id, recordType: "haengteuk", grade, content, hasNeis });
    }
    return recs;
  };

  // 6. 분석 학년별 역량 데이터 매핑
  type ScoreRow = { competency_item: string; grade_value: string; school_year: number };
  type TagRow = { record_id: string; record_type: string; competency_item: string; evaluation: string; evidence_summary: string | null };
  type QualityRow = { record_id: string; record_type: string; overall_score: number; issues: string[] | null; feedback: string | null };

  const recordIdsByGrade = new Map<number, Set<string>>();
  for (const grade of allGrades) {
    const ids = new Set<string>();
    for (const s of (seteksRes.data ?? []) as SetekRow[]) { if (s.grade === grade) ids.add(s.id); }
    for (const c of (changcheRes.data ?? []) as ChangcheRow[]) { if (c.grade === grade) ids.add(c.id); }
    for (const h of (haengteukRes.data ?? []) as HaengteukRow[]) { if (h.grade === grade) ids.add(h.id); }
    recordIdsByGrade.set(grade, ids);
  }

  // 7. 학년별 GradeOutput 조립
  const grades: Record<number, GradeOutput> = {};

  for (const grade of analysisGrades) {
    const sy = schoolYearForGrade(grade);
    const recordIds = recordIdsByGrade.get(grade) ?? new Set<string>();

    grades[grade] = {
      mode: "analysis",
      grade,
      competencyScores: ((scoresRes.data ?? []) as ScoreRow[])
        .filter((s) => s.school_year === sy)
        .map((s) => ({ competencyItem: s.competency_item, gradeValue: s.grade_value, schoolYear: s.school_year })),
      activityTags: ((tagsRes.data ?? []) as TagRow[])
        .filter((t) => recordIds.has(t.record_id))
        .map((t) => ({ recordId: t.record_id, recordType: t.record_type, competencyItem: t.competency_item, evaluation: t.evaluation, evidenceSummary: t.evidence_summary ?? undefined })),
      contentQuality: ((qualityRes.data ?? []) as QualityRow[])
        .filter((q) => recordIds.has(q.record_id))
        .map((q) => ({ recordId: q.record_id, recordType: q.record_type, overallScore: q.overall_score, issues: q.issues ?? [], feedback: q.feedback ?? "" })),
      directionGuides: [
        ...(setekGuidesByGrade.get(grade) ?? []),
        ...(changcheGuidesByGrade.get(grade) ?? []),
        ...(haengteukGuidesByGrade.get(grade) ?? []),
      ],
      records: buildRecords(grade),
    };
  }

  type PlanRow = { grade: number; semester: number; plan_status: string; subject: { name: string; subject_type?: { name: string } | null } | null };

  for (const grade of designGrades) {
    grades[grade] = {
      mode: "design",
      grade,
      competencyScores: [],
      activityTags: [],
      contentQuality: [],
      directionGuides: [
        ...(setekGuidesByGrade.get(grade) ?? []),
        ...(changcheGuidesByGrade.get(grade) ?? []),
        ...(haengteukGuidesByGrade.get(grade) ?? []),
      ],
      records: buildRecords(grade),
      coursePlans: ((coursePlansRes.data ?? []) as PlanRow[])
        .filter((p) => p.grade === grade)
        .map((p) => ({
          grade: p.grade,
          semester: p.semester,
          subjectName: p.subject?.name ?? "과목 미정",
          subjectType: p.subject?.subject_type?.name ?? undefined,
          planStatus: p.plan_status,
        })),
    };
  }

  const result: UnifiedGradeInput = {
    grades,
    analysisGrades,
    designGrades,
    hasAnyAnalysis: analysisGrades.length > 0,
    hasAnyDesign: designGrades.length > 0,
    isHybrid: analysisGrades.length > 0 && designGrades.length > 0,
  };

  logActionDebug(LOG_CTX, `UnifiedGradeInput built: analysis=${analysisGrades}, design=${designGrades}, hybrid=${result.isHybrid}`);
  return result;
}

// ============================================
// 가상 레코드 변환
// ============================================

/** 설계 학년의 방향 가이드 → RecordSummary[] (스토리라인/면접용) */
export function buildVirtualRecordsFromGuides(
  guides: DirectionGuideSummary[],
): RecordSummary[] {
  return guides
    .filter((g) => g.direction.length > 0)
    .map((g, i) => ({
      index: i,
      id: g.id,
      grade: g.grade,
      subject: g.subjectName ?? g.activityType ?? (g.type === "haengteuk" ? "행동특성" : g.type),
      type: g.type,
      content: buildVirtualContent(g),
    }));
}

function buildVirtualContent(guide: DirectionGuideSummary): string {
  const parts: string[] = [];
  if (guide.direction) parts.push(guide.direction);
  if (guide.keywords.length > 0) parts.push(`핵심 키워드: ${guide.keywords.join(", ")}`);
  if (guide.teacherPoints.length > 0) parts.push(`교사 관찰 포인트: ${guide.teacherPoints.join("; ")}`);
  return parts.join("\n");
}

/** 설계 학년의 방향 가이드 → 가상 ActivityTag[] (엣지용) */
export function buildVirtualTagsFromGuides(
  guides: DirectionGuideSummary[],
): UnifiedActivityTag[] {
  const tags: UnifiedActivityTag[] = [];
  for (const guide of guides) {
    for (const comp of guide.competencyFocus) {
      tags.push({
        recordId: guide.id,
        recordType: guide.type,
        competencyItem: comp,
        evaluation: "expected",
        isVirtual: true,
      });
    }
  }
  return tags;
}

// ============================================
// 커버리지 경고
// ============================================

export function checkCoverageForTask(
  input: UnifiedGradeInput,
  taskKey: string,
): import("./pipeline-types").DataCoverageWarning[] {
  const warnings: import("./pipeline-types").DataCoverageWarning[] = [];

  if (!input.hasAnyAnalysis) {
    warnings.push({
      taskKey,
      code: "no_analysis",
      message: "모든 학년이 설계 모드입니다. NEIS 분석 결과 없이 방향 가이드만으로 종합됩니다.",
      affectedGrades: input.designGrades,
      severity: "warning",
    });
  } else if (input.isHybrid) {
    warnings.push({
      taskKey,
      code: "partial_analysis",
      message: `${input.designGrades.map((g) => `${g}학년`).join(", ")}은(는) 설계 모드입니다. 해당 학년은 방향 가이드만으로 종합됩니다.`,
      affectedGrades: input.designGrades,
      severity: "info",
    });
  }

  return warnings;
}

// ============================================
// 헬퍼: 분석/설계 학년 데이터 수집
// ============================================

/** 분석 학년의 실 레코드를 RecordSummary 형식으로 수집 */
export function collectAnalysisRecords(input: UnifiedGradeInput): RecordSummary[] {
  const records: RecordSummary[] = [];
  let idx = 0;
  for (const grade of input.analysisGrades) {
    const go = input.grades[grade];
    if (go.mode !== "analysis") continue;
    for (const rec of go.records) {
      if (rec.content.length < PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH) continue;
      records.push({
        index: idx++,
        id: rec.id,
        grade: rec.grade,
        subject: rec.subjectName ?? rec.activityType ?? rec.recordType,
        type: rec.recordType,
        content: rec.content,
      });
    }
  }
  return records;
}

/** 설계 학년의 방향 가이드를 RecordSummary 형식으로 수집 */
export function collectDesignRecords(input: UnifiedGradeInput): RecordSummary[] {
  const allGuides: DirectionGuideSummary[] = [];
  for (const grade of input.designGrades) {
    const go = input.grades[grade];
    if (go.mode !== "design") continue;
    allGuides.push(...go.directionGuides);
  }
  return buildVirtualRecordsFromGuides(allGuides);
}

/** 전 학년 활동 태그 수집 (분석 학년: 실 태그, 설계 학년: 가상 태그) */
export function collectAllTags(input: UnifiedGradeInput): UnifiedActivityTag[] {
  const tags: UnifiedActivityTag[] = [];
  for (const grade of input.analysisGrades) {
    const go = input.grades[grade];
    if (go.mode !== "analysis") continue;
    tags.push(...go.activityTags);
  }
  for (const grade of input.designGrades) {
    const go = input.grades[grade];
    if (go.mode !== "design") continue;
    tags.push(...buildVirtualTagsFromGuides(go.directionGuides));
  }
  return tags;
}
