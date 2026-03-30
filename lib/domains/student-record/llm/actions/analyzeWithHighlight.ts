"use server";

// ============================================
// 세특 인라인 하이라이트 분석 Server Action
// Phase 6.1 — 원문 구절 인용 + 역량 태깅
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { generateTextWithRateLimit } from "@/lib/domains/plan/llm/ai-sdk";
import {
  HIGHLIGHT_SYSTEM_PROMPT,
  buildHighlightUserPrompt,
  parseHighlightResponse,
  buildBatchHighlightUserPrompt,
  parseBatchHighlightResponse,
} from "../prompts/competencyHighlight";
import type { HighlightAnalysisInput, HighlightAnalysisResult, BatchHighlightInput, BatchHighlightResult } from "../types";

const LOG_CTX = { domain: "student-record", action: "analyzeWithHighlight" };

/**
 * careerContext가 없고 studentId가 제공되면 DB에서 자동 조회합니다.
 * 파이프라인/클라이언트 양쪽에서 동일한 진로 컨텍스트를 사용합니다.
 */
export async function analyzeSetekWithHighlight(
  input: HighlightAnalysisInput & { studentId?: string },
): Promise<{ success: true; data: HighlightAnalysisResult } | { success: false; error: string }> {
  try {
    await requireAdminOrConsultant();

    if (!input.content || input.content.trim().length < 20) {
      return { success: false, error: "분석할 텍스트가 너무 짧습니다 (20자 이상 필요)." };
    }

    // careerContext 자동 조회: studentId 있고 careerContext 없으면 DB에서 조립
    if (!input.careerContext && input.studentId) {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const { data: student } = await supabase
        .from("students")
        .select("target_major")
        .eq("id", input.studentId)
        .maybeSingle();
      const tgtMajor = student?.target_major as string | null;
      if (tgtMajor) {
        const { data: scoreRows } = await supabase
          .from("student_internal_scores")
          .select("subject:subject_id(name), rank_grade, grade, semester")
          .eq("student_id", input.studentId)
          .order("grade")
          .order("semester");
        type HighlightScoreRow = { subject: { name: string } | null; rank_grade: number | null; grade: number | null; semester: number | null };
        const allRows = (scoreRows ?? []) as unknown as HighlightScoreRow[];
        const scores = allRows.map((s) => ({
          subjectName: s.subject?.name ?? "",
          rankGrade: s.rank_grade ?? 5,
        })).filter((s: { subjectName: string }) => s.subjectName);

        // 학기별 성적 추이 (rank_grade가 있는 과목만)
        const gradeTrend = allRows
          .filter((s) => s.rank_grade != null)
          .map((s) => ({
            grade: s.grade ?? 1,
            semester: s.semester ?? 1,
            subjectName: s.subject?.name ?? "",
            rankGrade: s.rank_grade!,
          }));

        input.careerContext = {
          targetMajor: tgtMajor,
          takenSubjects: [...new Set(scores.map((s: { subjectName: string }) => s.subjectName))],
          relevantScores: scores,
          gradeTrend,
        };
      }
    }

    const userPrompt = buildHighlightUserPrompt(input);

    const result = await generateTextWithRateLimit({
      system: HIGHLIGHT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "advanced",
      temperature: 0.3,
      maxTokens: 16384,
      responseFormat: "json",
    });

    if (!result.content) {
      return { success: false, error: "AI 응답이 비어있습니다." };
    }

    const parsed = parseHighlightResponse(result.content);

    // Phase 6.2: sectionText 검증 — 커버리지 70% 미만이면 폴백
    if (input.recordType === "setek" || input.recordType === "personal_setek") {
      const totalCovered = parsed.sections.reduce((sum, s) => sum + (s.sectionText?.length ?? 0), 0);
      if (totalCovered > 0 && totalCovered < input.content.length * 0.7) {
        for (const s of parsed.sections) {
          delete s.sectionText;
        }
      }
    }

    if (parsed.sections.length === 0) {
      return {
        success: true,
        data: { sections: [], competencyGrades: [], summary: "해당 텍스트에서 명확한 역량 근거를 찾지 못했습니다." },
      };
    }

    return { success: true, data: parsed };
  } catch (error) {
    logActionError(LOG_CTX, error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return { success: false, error: "AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요." };
    }
    if (error instanceof SyntaxError) {
      return { success: false, error: "AI 응답 파싱에 실패했습니다. 다시 시도해주세요." };
    }
    return { success: false, error: "역량 분석 중 오류가 발생했습니다." };
  }
}

// ============================================
// 배치 분석 (파이프라인 전용)
// 3-4개 레코드를 1회 LLM 호출로 묶어 처리
// ============================================

/**
 * 다중 레코드 배치 분석
 * careerContext는 파이프라인에서 사전 조회하여 전달
 * 실패 레코드는 failedIds로 반환 → 호출자가 개별 재시도
 */
export async function analyzeSetekBatchWithHighlight(
  input: BatchHighlightInput,
): Promise<BatchHighlightResult> {
  await requireAdminOrConsultant();

  const validRecords = input.records.filter((r) => r.content?.trim().length >= 20);
  const invalidIds = input.records
    .filter((r) => !r.content || r.content.trim().length < 20)
    .map((r) => r.id);

  if (validRecords.length === 0) {
    return { succeeded: new Map(), failedIds: invalidIds };
  }

  // 1건이면 단건 함수 위임
  if (validRecords.length === 1) {
    const rec = validRecords[0];
    const result = await analyzeSetekWithHighlight({
      content: rec.content,
      recordType: rec.recordType,
      subjectName: rec.subjectName,
      grade: rec.grade,
      careerContext: input.careerContext,
    });
    const succeeded = new Map<string, HighlightAnalysisResult>();
    if (result.success) succeeded.set(rec.id, result.data);
    return {
      succeeded,
      failedIds: [...invalidIds, ...(result.success ? [] : [rec.id])],
    };
  }

  const userPrompt = buildBatchHighlightUserPrompt(validRecords, input.careerContext);
  const maxTokens = Math.min(validRecords.length * 3500, 16384);

  try {
    const result = await generateTextWithRateLimit({
      system: HIGHLIGHT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier: "fast",
      temperature: 0.3,
      maxTokens,
      responseFormat: "json",
    });

    if (!result.content) {
      return {
        succeeded: new Map(),
        failedIds: [...invalidIds, ...validRecords.map((r) => r.id)],
      };
    }

    const expectedIds = validRecords.map((r) => r.id);
    const batchResult = parseBatchHighlightResponse(result.content, expectedIds);

    // Phase 6.2: sectionText 커버리지 검증 (레코드별)
    for (const [id, data] of batchResult.succeeded) {
      const rec = validRecords.find((r) => r.id === id);
      if (rec && (rec.recordType === "setek" || rec.recordType === "personal_setek")) {
        const totalCovered = data.sections.reduce((sum, s) => sum + (s.sectionText?.length ?? 0), 0);
        if (totalCovered > 0 && totalCovered < rec.content.length * 0.7) {
          for (const s of data.sections) delete s.sectionText;
        }
      }
    }

    batchResult.failedIds.push(...invalidIds);
    return batchResult;
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "analyzeWithHighlight.batch" }, error);
    return {
      succeeded: new Map(),
      failedIds: [...invalidIds, ...validRecords.map((r) => r.id)],
    };
  }
}
