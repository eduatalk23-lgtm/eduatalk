"use server";

// ============================================
// Past Storyline 생성 Server Action (scope='past')
//
// 4축×3층 통합 아키텍처 A층. 2026-04-16 D 세션 B.
// NEIS 확정 기록만을 입력으로 과거 서사를 생성한다.
// Final Storyline(detectInquiryLinks)과 별개 — Blueprint/미래 투사 일체 배제.
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import { handleLlmActionError } from "../error-handler";
import { generateTextWithRateLimit } from "../ai-client";
import { withRetry } from "../retry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PIPELINE_THRESHOLDS } from "@/lib/domains/student-record/constants";
import {
  PAST_STORYLINE_SYSTEM_PROMPT,
  buildPastStorylineUserPrompt,
  parsePastStorylineResponse,
  type PastStorylineResult,
} from "../prompts/pastStorylinePrompt";
import type { RecordSummary } from "../prompts/inquiryLinking";
import type { ActionResponse } from "@/lib/types/actionResponse";

const LOG_CTX = { domain: "record-analysis", action: "generatePastStoryline" };

export interface PastStorylinePersistResult extends PastStorylineResult {
  savedCount: number;
}

/**
 * Past Storyline LLM 호출 + scope='past' 영속화.
 * NEIS 학년이 2건 미만이거나 입력 레코드가 2건 미만이면 skip.
 */
export async function generatePastStoryline(
  studentId: string,
  tenantId: string,
  neisGrades: number[],
): Promise<ActionResponse<PastStorylinePersistResult>> {
  try {
    await requireAdminOrConsultant();

    if (!neisGrades || neisGrades.length === 0) {
      return { success: false, error: "NEIS 학년 없음 — Past Storyline 스킵" };
    }

    const supabase = await createSupabaseServerClient();

    // ── 1. NEIS 레코드 수집 (imported/confirmed만, ai_draft 배제) ──
    const { data: seteks } = await supabase
      .from("student_record_seteks")
      .select(
        "id, content, confirmed_content, imported_content, grade, subject:subject_id(name)",
      )
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .in("grade", neisGrades)
      .is("deleted_at", null);

    const { data: changche } = await supabase
      .from("student_record_changche")
      .select("id, content, confirmed_content, imported_content, grade, activity_type")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .in("grade", neisGrades);

    const records: RecordSummary[] = [];
    let idx = 0;

    for (const s of (seteks ?? []).sort((a, b) => a.grade - b.grade)) {
      const text =
        (s.imported_content as string | null) ||
        (s.confirmed_content as string | null) ||
        (s.content as string | null) ||
        "";
      if (!text || text.length < PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH) continue;
      records.push({
        index: idx++,
        id: s.id as string,
        grade: s.grade as number,
        subject:
          (s.subject as { name?: string } | null)?.name ?? "과목 미정",
        type: "setek",
        content: text,
      });
    }

    for (const c of (changche ?? []).sort((a, b) => a.grade - b.grade)) {
      const text =
        (c.imported_content as string | null) ||
        (c.confirmed_content as string | null) ||
        (c.content as string | null) ||
        "";
      if (!text || text.length < PIPELINE_THRESHOLDS.MIN_IMPORTED_LENGTH) continue;
      records.push({
        index: idx++,
        id: c.id as string,
        grade: c.grade as number,
        subject: (c.activity_type as string | null) ?? "창체",
        type: "changche",
        content: text,
      });
    }

    if (records.length < 2) {
      logActionDebug(LOG_CTX, "레코드 2건 미만 — Past Storyline 스킵", {
        studentId,
        recordCount: records.length,
      });
      return {
        success: true,
        data: { connections: [], storylines: [], savedCount: 0 },
      };
    }

    // ── 2. LLM 호출 ──
    const userPrompt = buildPastStorylineUserPrompt(records, neisGrades);
    const tier = records.length >= 20 ? "advanced" : "fast";
    const maxTokens = records.length >= 20 ? 6000 : 3500;

    const result = await withRetry(
      () =>
        generateTextWithRateLimit({
          system: PAST_STORYLINE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          modelTier: tier,
          temperature: 0.3,
          maxTokens,
          responseFormat: "json",
        }),
      { label: "generatePastStoryline" },
    );

    if (!result.content) {
      return { success: false, error: "Past Storyline AI 응답이 비어있습니다." };
    }

    const parsed = parsePastStorylineResponse(result.content, records.length - 1);

    if (parsed.storylines.length === 0) {
      logActionDebug(LOG_CTX, "Past Storyline 연결 미감지", { studentId });
      return {
        success: true,
        data: { ...parsed, savedCount: 0 },
      };
    }

    // ── 3. 기존 scope='past' 스토리라인 제거 (links는 CASCADE) ──
    const { deleteStorylinesByScope } = await import(
      "@/lib/domains/student-record/repository/storyline-repository"
    );
    await deleteStorylinesByScope(studentId, tenantId, "past");

    // ── 4. 신규 scope='past' 스토리라인 + 링크 영속화 ──
    let savedCount = 0;
    for (let i = 0; i < parsed.storylines.length; i++) {
      const sl = parsed.storylines[i];
      try {
        // 스토리라인 INSERT
        const { data: inserted, error: slErr } = await supabase
          .from("student_record_storylines")
          .insert({
            tenant_id: tenantId,
            student_id: studentId,
            title: `[Past] ${sl.title}`,
            keywords: sl.keywords,
            narrative: sl.narrative || null,
            career_field: sl.careerField || null,
            grade_1_theme: sl.grade1Theme || null,
            grade_2_theme: sl.grade2Theme || null,
            grade_3_theme: sl.grade3Theme || null,
            strength: "moderate",
            sort_order: i,
            scope: "past",
          })
          .select("id")
          .single();

        if (slErr || !inserted) {
          logActionError(LOG_CTX, slErr ?? "storyline insert 실패", {
            studentId,
            title: sl.title,
          });
          continue;
        }

        // 링크 수집
        const linkedIds = new Set<string>();
        const linkEntries: Array<{
          tenant_id: string;
          storyline_id: string;
          record_type: string;
          record_id: string;
          grade: number;
          connection_note: string;
          sort_order: number;
        }> = [];
        for (const connIdx of sl.connectionIndices) {
          const conn = parsed.connections[connIdx];
          if (!conn) continue;
          for (const recIdx of [conn.fromIndex, conn.toIndex]) {
            const rec = records[recIdx];
            if (!rec || linkedIds.has(rec.id)) continue;
            linkedIds.add(rec.id);
            linkEntries.push({
              tenant_id: tenantId,
              storyline_id: inserted.id,
              record_type: rec.type,
              record_id: rec.id,
              grade: rec.grade,
              connection_note: conn.reasoning,
              sort_order: linkEntries.length,
            });
          }
        }

        if (linkEntries.length > 0) {
          const { error: linkErr } = await supabase
            .from("student_record_storyline_links")
            .insert(linkEntries);
          if (linkErr) {
            logActionError(LOG_CTX, linkErr, {
              studentId,
              storylineId: inserted.id,
            });
          }
        }

        savedCount++;
      } catch (err) {
        logActionError(LOG_CTX, err, { studentId, title: sl.title });
      }
    }

    logActionDebug(LOG_CTX, "Past Storyline 영속화 완료", {
      studentId,
      neisGrades,
      savedCount,
      connectionCount: parsed.connections.length,
    });

    return {
      success: true,
      data: { ...parsed, savedCount },
    };
  } catch (error) {
    return handleLlmActionError(error, "Past Storyline 생성", LOG_CTX);
  }
}
