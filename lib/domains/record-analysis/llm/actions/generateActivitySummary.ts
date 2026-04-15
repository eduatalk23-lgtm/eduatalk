"use server";

// ============================================
// Phase 9.2 — AI 활동 요약서 생성 Server Action
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { fetchReportData } from "@/lib/domains/student-record/actions/report";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseResponse,
} from "../prompts/activitySummary";
import type { ActivitySummaryInput, ActivitySummaryMode, ActivitySummaryResult } from "../types";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { syncPipelineTaskStatus } from "@/lib/domains/student-record/actions/pipeline";

const LOG_CTX = { domain: "record-analysis", action: "generateActivitySummary" };

/**
 * B8: 설계 산출물 보강 — prospective/hybrid 학년의 활동 청사진 근거.
 *   수강계획(course_plans) + 탐구가이드 배정(exploration_guide_assignments)에서
 *   학년별 주요 과목/탐구 주제를 추출하여 prompt에 주입.
 *   가안조차 없는 학년에도 "이런 방향으로 활동 예정"을 서술 가능하게 함.
 */
async function buildDesignArtifactsSection(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  grades: number[],
): Promise<string | undefined> {
  const lines: string[] = [];

  const { data: plans } = await supabase
    .from("course_plans")
    .select("grade, semester, plan_status, subject:subject_id(name)")
    .eq("student_id", studentId)
    .in("grade", grades)
    .in("plan_status", ["confirmed", "recommended"]);

  if (plans && plans.length > 0) {
    const byGrade = new Map<number, string[]>();
    for (const p of plans as Array<{ grade: number; semester: number | null; subject?: { name?: string } | { name?: string }[] | null }>) {
      const sub = Array.isArray(p.subject) ? p.subject[0] : p.subject;
      const name = sub?.name ?? "과목 미정";
      const sem = p.semester != null ? `${p.semester}학기 ` : "";
      const arr = byGrade.get(p.grade) ?? [];
      arr.push(`${sem}${name}`);
      byGrade.set(p.grade, arr);
    }
    if (byGrade.size > 0) {
      lines.push("### 수강 계획 (예정 교과)");
      for (const [g, subs] of [...byGrade.entries()].sort(([a], [b]) => a - b)) {
        lines.push(`- ${g}학년: ${subs.join(", ")}`);
      }
    }
  }

  const { data: guides } = await supabase
    .from("exploration_guide_assignments")
    .select("grade, exploration_guides:guide_id(title, guide_type)")
    .eq("student_id", studentId)
    .in("grade", grades);

  if (guides && guides.length > 0) {
    const byGrade = new Map<number, string[]>();
    for (const g of guides as Array<{ grade: number | null; exploration_guides?: { title?: string } | { title?: string }[] | null }>) {
      if (g.grade == null) continue;
      const guide = Array.isArray(g.exploration_guides) ? g.exploration_guides[0] : g.exploration_guides;
      if (!guide?.title) continue;
      const arr = byGrade.get(g.grade) ?? [];
      arr.push(guide.title);
      byGrade.set(g.grade, arr);
    }
    if (byGrade.size > 0) {
      if (lines.length > 0) lines.push("");
      lines.push("### 탐구 가이드 배정 (예정 탐구 주제)");
      for (const [g, titles] of [...byGrade.entries()].sort(([a], [b]) => a - b)) {
        // 학년당 최대 6건만 발췌
        const sample = titles.slice(0, 6);
        lines.push(`- ${g}학년: ${sample.join(" / ")}${titles.length > 6 ? ` 등 총 ${titles.length}건` : ""}`);
      }
    }
  }

  if (lines.length === 0) return undefined;
  return ["## 설계 산출물 (예정된 활동의 근거)", ...lines].join("\n");
}

export async function generateActivitySummary(
  studentId: string,
  targetGrades?: number[],
  /** Phase E2: 파이프라인에서 전달되는 엣지 프롬프트 섹션 */
  edgePromptSection?: string,
  /** 파이프라인에서 전달되는 ReportData (있으면 fetchReportData 호출 스킵) */
  cachedReport?: import("@/lib/domains/student-record/actions/report").ReportData,
): Promise<ActionResponse<ActivitySummaryResult & { summaryId: string }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    // cachedReport가 있으면 fetchReportData 스킵
    let report: import("@/lib/domains/student-record/actions/report").ReportData;
    if (cachedReport) {
      report = cachedReport;
    } else {
      const reportResult = await fetchReportData(studentId);
      if (!reportResult.success || !reportResult.data) {
        return {
          success: false,
          error: reportResult.success === false ? reportResult.error : "데이터 수집 실패",
        };
      }
      report = reportResult.data;
    }
    const studentGrade = report.student.grade;
    // B13: 3년 통합 설계 원칙 — targetGrades 미지정 시 [1,2,3] 전체.
    //   studentGrade 는 4-layer 해소와 gradeMode 판정에 계속 사용된다(톤 분기 전용).
    const grades = targetGrades ?? [1, 2, 3];

    // subject_id → 과목명 매핑
    const supabase = await createSupabaseServerClient();
    const allSubjectIds = new Set<string>();
    for (const grade of grades) {
      const data = report.recordDataByGrade[grade];
      if (!data) continue;
      for (const s of data.seteks) allSubjectIds.add(s.subject_id);
    }
    const subjectMap = new Map<string, string>();
    if (allSubjectIds.size > 0) {
      const { data: subjects } = await supabase
        .from("subjects")
        .select("id, name")
        .in("id", [...allSubjectIds]);
      for (const s of subjects ?? []) subjectMap.set(s.id, s.name);
    }

    // B8: 4-layer 콘텐츠 해소 헬퍼 (imported > confirmed > content > ai_draft)
    //   - text=실제 사용 콘텐츠, source=출처 라벨, isDraft=AI 가안 여부
    type Source = "imported" | "confirmed" | "content" | "ai_draft" | "none";
    const resolve = (r: {
      imported_content?: string | null;
      confirmed_content?: string | null;
      content?: string | null;
      ai_draft_content?: string | null;
    }): { text: string; source: Source } => {
      const imp = r.imported_content?.trim();
      if (imp) return { text: imp, source: "imported" };
      const conf = r.confirmed_content?.trim();
      if (conf) return { text: conf, source: "confirmed" };
      const con = r.content?.trim();
      if (con) return { text: con, source: "content" };
      const draft = r.ai_draft_content?.trim();
      if (draft) return { text: draft, source: "ai_draft" };
      return { text: "", source: "none" };
    };

    // RecordTabData → ActivitySummaryInput 변환 (B8 4-layer + isDraft 라벨)
    const recordDataByGrade: ActivitySummaryInput["recordDataByGrade"] = {};
    for (const grade of grades) {
      const data = report.recordDataByGrade[grade];
      if (!data) continue;

      const seteksResolved = data.seteks
        .map((s) => ({ ...resolve(s), subject_id: s.subject_id }))
        .filter((s) => s.text);
      const personalSeteksResolved = data.personalSeteks
        .map((ps) => ({ ...resolve(ps), title: ps.title ?? "개인 세특" }))
        .filter((ps) => ps.text);
      const changcheResolved = data.changche
        .map((c) => ({ ...resolve(c), activity_type: c.activity_type }))
        .filter((c) => c.text);
      const haengteukResolved = data.haengteuk ? resolve(data.haengteuk) : null;

      // 학년 단위 모드 판정 — 가안 비율로 결정
      const sources: Source[] = [
        ...seteksResolved.map((s) => s.source),
        ...personalSeteksResolved.map((ps) => ps.source),
        ...changcheResolved.map((c) => c.source),
        ...(haengteukResolved && haengteukResolved.text ? [haengteukResolved.source] : []),
      ];
      const draftCount = sources.filter((s) => s === "ai_draft").length;
      const realCount = sources.filter((s) => s !== "ai_draft" && s !== "none").length;
      const gradeMode: ActivitySummaryMode =
        sources.length === 0
          ? "analysis"
          : realCount === 0
            ? "prospective"
            : draftCount === 0
              ? "analysis"
              : "hybrid";

      recordDataByGrade[grade] = {
        gradeMode,
        seteks: seteksResolved.map((s) => ({
          subject_name: subjectMap.get(s.subject_id) ?? "과목 미정",
          content: s.text,
          isDraft: s.source === "ai_draft",
        })),
        personalSeteks: personalSeteksResolved.map((ps) => ({
          title: ps.title,
          content: ps.text,
          isDraft: ps.source === "ai_draft",
        })),
        changche: changcheResolved.map((c) => ({
          activity_type: c.activity_type,
          content: c.text,
          isDraft: c.source === "ai_draft",
        })),
        haengteuk:
          haengteukResolved && haengteukResolved.text
            ? { content: haengteukResolved.text, isDraft: haengteukResolved.source === "ai_draft" }
            : null,
        readings: (data.readings ?? []).map((r) => ({
          book_title: r.book_title,
          book_author: r.author ?? undefined,
        })),
      };
    }

    // B8: 전체 모드 판정 — 학년별 모드 분포로 결정
    const gradeModes = Object.values(recordDataByGrade).map((d) => d.gradeMode);
    const hasAnalysis = gradeModes.includes("analysis") || gradeModes.includes("hybrid");
    const hasProspective = gradeModes.includes("prospective") || gradeModes.includes("hybrid");
    const overallMode: ActivitySummaryMode =
      hasAnalysis && hasProspective ? "hybrid" : hasProspective ? "prospective" : "analysis";

    // 데이터 유무 체크 — 가안도 데이터로 인정 (B8 시계열 원칙)
    const hasAnyData = Object.values(recordDataByGrade).some(
      (d) =>
        d.seteks.length > 0 ||
        d.personalSeteks.length > 0 ||
        d.changche.length > 0 ||
        d.haengteuk !== null ||
        d.readings.length > 0,
    );

    // B8: 가안조차 없는 완전 빈 상태 — 설계 산출물(course_plans, guides)도 없으면 fail.
    //   여기서는 보강 산출물 조회를 시도하고, 그것마저 비면 진짜 fail.
    let designArtifactsSection: string | undefined;
    if (!hasAnyData || hasProspective) {
      designArtifactsSection = await buildDesignArtifactsSection(supabase, studentId, grades);
    }

    if (!hasAnyData && !designArtifactsSection) {
      return {
        success: false,
        error: "생기부 기록 데이터가 없습니다. 기록을 입력하거나 수강계획·탐구가이드를 먼저 설계해주세요.",
      };
    }

    // Q3: 이전 학년 요약 조회 (다학년 비교 성장 서술용)
    let previousSummaryText: string | undefined;
    if (grades.length > 0 && grades[0] > 1) {
      const { data: prevSummaries } = await supabase
        .from("student_record_activity_summaries")
        .select("summary_text")
        .eq("student_id", studentId)
        .contains("target_grades", [grades[0] - 1])
        .order("created_at", { ascending: false })
        .limit(1);
      if (prevSummaries && prevSummaries[0]?.summary_text) {
        previousSummaryText = prevSummaries[0].summary_text;
      }
    }

    const input: ActivitySummaryInput = {
      studentName: report.student.name ?? "학생",
      grade: studentGrade,
      targetMajor: report.student.targetMajor ?? undefined,
      targetGrades: grades,
      mode: overallMode,
      recordDataByGrade,
      storylines: report.storylineData.storylines.map((sl) => ({
        title: sl.title,
        keywords: sl.keywords,
      })),
      edgePromptSection,
      previousSummaryText,
      designArtifactsSection,
    };

    // AI SDK 호출
    const userPrompt = buildUserPrompt(input);

    const result = await withRetry(
      () => generateTextWithRateLimit({
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        modelTier: "standard",
        temperature: 0.3,
        maxTokens: 8192,
        responseFormat: "json",
      }),
      { label: "generateActivitySummary" },
    );

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다. 다시 시도해주세요." };
    }

    const parsed = parseResponse(result.content);

    if (parsed.sections.length === 0) {
      return { success: false, error: "AI가 유효한 요약서를 생성하지 못했습니다. 다시 시도해주세요." };
    }

    // DB 저장
    const currentSchoolYear = calculateSchoolYear();

    const { data: inserted, error: insertError } = await supabase
      .from("student_record_activity_summaries")
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: currentSchoolYear,
        target_grades: grades,
        summary_title: parsed.title,
        summary_sections: (await import("@/lib/domains/student-record/types")).toDbJson(parsed.sections),
        summary_text: parsed.fullText,
        model_tier: "standard",
        prompt_version: "v1",
        status: "draft",
        source: "ai",
        created_by: userId,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      logActionError(LOG_CTX, insertError);
      return { success: false, error: "요약서 저장 실패" };
    }

    // 파이프라인 상태 동기화 (fire-and-forget)
    syncPipelineTaskStatus(studentId, "activity_summary").catch((err) =>
      logActionWarn(LOG_CTX, "파이프라인 상태 동기화 실패", { studentId, task: "activity_summary", error: String(err) }),
    );

    return {
      success: true,
      data: { ...parsed, summaryId: inserted.id },
    };
  } catch (error) {
    return handleLlmActionError(error, "활동 요약서 생성", LOG_CTX);
  }
}
