"use server";

// ============================================
// Phase 9.2 — AI 활동 요약서 생성 Server Action
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import { withRetry } from "../retry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { fetchReportData } from "../../actions/report";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseResponse,
} from "../prompts/activitySummary";
import type { ActivitySummaryInput, ActivitySummaryResult } from "../types";
import type { ActionResponse } from "@/lib/types/actionResponse";
import { syncPipelineTaskStatus } from "../../actions/pipeline";

const LOG_CTX = { domain: "student-record", action: "generateActivitySummary" };

export async function generateActivitySummary(
  studentId: string,
  targetGrades?: number[],
  /** Phase E2: 파이프라인에서 전달되는 엣지 프롬프트 섹션 */
  edgePromptSection?: string,
): Promise<ActionResponse<ActivitySummaryResult & { summaryId: string }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant();
    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    // 기존 fetchReportData 재사용하여 데이터 수집
    const reportResult = await fetchReportData(studentId);
    if (!reportResult.success || !reportResult.data) {
      return {
        success: false,
        error: reportResult.success === false ? reportResult.error : "데이터 수집 실패",
      };
    }

    const report = reportResult.data;
    const studentGrade = report.student.grade;
    const grades = targetGrades ?? Array.from({ length: studentGrade }, (_, i) => i + 1);

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

    // RecordTabData → ActivitySummaryInput 변환
    const recordDataByGrade: ActivitySummaryInput["recordDataByGrade"] = {};
    for (const grade of grades) {
      const data = report.recordDataByGrade[grade];
      if (!data) continue;

      recordDataByGrade[grade] = {
        seteks: data.seteks
          .filter((s) => s.content || s.imported_content)
          .map((s) => ({
            subject_name: subjectMap.get(s.subject_id) ?? "과목 미정",
            content: s.imported_content?.trim() ? s.imported_content : (s.content || ""),
          })),
        personalSeteks: data.personalSeteks
          .filter((ps) => ps.content || ps.imported_content)
          .map((ps) => ({
            title: ps.title ?? "개인 세특",
            content: ps.imported_content?.trim() ? ps.imported_content : (ps.content || ""),
          })),
        changche: data.changche
          .filter((c) => c.content || c.imported_content)
          .map((c) => ({
            activity_type: c.activity_type,
            content: c.imported_content?.trim() ? c.imported_content : (c.content || ""),
          })),
        haengteuk: (data.haengteuk?.imported_content?.trim() || data.haengteuk?.content)
          ? { content: data.haengteuk?.imported_content?.trim() ? data.haengteuk.imported_content : (data.haengteuk?.content ?? "") }
          : null,
        readings: (data.readings ?? []).map((r) => ({
          book_title: r.book_title,
          book_author: r.author ?? undefined,
        })),
      };
    }

    // 데이터 유무 체크
    const hasAnyData = Object.values(recordDataByGrade).some(
      (d) =>
        d.seteks.length > 0 ||
        d.personalSeteks.length > 0 ||
        d.changche.length > 0 ||
        d.haengteuk !== null ||
        d.readings.length > 0,
    );

    if (!hasAnyData) {
      return {
        success: false,
        error: "생기부 기록 데이터가 없습니다. 먼저 기록을 입력해주세요.",
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
      recordDataByGrade,
      storylines: report.storylineData.storylines.map((sl) => ({
        title: sl.title,
        keywords: sl.keywords,
      })),
      edgePromptSection,
      previousSummaryText,
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
        summary_sections: (await import("../../types")).toDbJson(parsed.sections),
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
    logActionError(LOG_CTX, error);

    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요." };
    }
    if (error instanceof SyntaxError || msg.includes("JSON")) {
      return { success: false, error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요." };
    }

    return { success: false, error: "활동 요약서 생성 중 오류가 발생했습니다." };
  }
}
