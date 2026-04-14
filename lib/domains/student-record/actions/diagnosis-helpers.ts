"use server";

// ============================================
// 진단 보조 Server Actions (엣지 조회, 면접 질문)
// diagnosis.ts에서 분리 (M1 구조 개선)
// ============================================

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { logActionError } from "@/lib/logging/actionLogger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PersistedEdge } from "../repository/edge-repository";
import type { PersistedHyperedge } from "../repository/hyperedge-repository";
import type { PersistedNarrativeArc } from "../repository/narrative-arc-repository";
import type { PersistedProfileCard } from "../repository/profile-card-repository";

const LOG_CTX = { domain: "student-record", action: "diagnosis-helpers" };

/** 학생의 DB 영속화 엣지 목록 조회 */
export async function fetchPersistedEdges(
  studentId: string,
  tenantId: string,
): Promise<PersistedEdge[]> {
  try {
    await requireAdminOrConsultant();
    const { findEdges } = await import("../repository/edge-repository");
    return await findEdges(studentId, tenantId);
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPersistedEdges" }, error, { studentId });
    return [];
  }
}

/** 학생의 DB 영속화 하이퍼엣지 목록 조회 (Phase 1 Layer 2) */
export async function fetchPersistedHyperedges(
  studentId: string,
  tenantId: string,
): Promise<PersistedHyperedge[]> {
  try {
    await requireAdminOrConsultant();
    const { findHyperedges } = await import("../repository/hyperedge-repository");
    return await findHyperedges(studentId, tenantId, { contexts: ["analysis", "synthesis_inferred"] });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPersistedHyperedges" }, error, { studentId });
    return [];
  }
}

/** 학생의 DB 영속화 narrative_arc 목록 조회 (Phase 2 Layer 3) */
export async function fetchPersistedNarrativeArcs(
  studentId: string,
  tenantId: string,
): Promise<PersistedNarrativeArc[]> {
  try {
    await requireAdminOrConsultant();
    const { findNarrativeArcsByStudent } = await import("../repository/narrative-arc-repository");
    return await findNarrativeArcsByStudent(studentId, tenantId, { source: "ai" });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPersistedNarrativeArcs" }, error, { studentId });
    return [];
  }
}

/** 학생의 DB 영속화 profile_card 목록 조회 (H2 Layer 0, 학년별) */
export async function fetchPersistedProfileCards(
  studentId: string,
  tenantId: string,
): Promise<PersistedProfileCard[]> {
  try {
    await requireAdminOrConsultant();
    const { findProfileCardsByStudent } = await import("../repository/profile-card-repository");
    return await findProfileCardsByStudent(studentId, tenantId, { source: "ai" });
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchPersistedProfileCards" }, error, { studentId });
    return [];
  }
}

/** 학생의 면접 예상 질문 조회 */
export async function fetchInterviewQuestions(
  studentId: string,
): Promise<Array<{ question: string; question_type: string; difficulty: string | null; suggested_answer: string | null }>> {
  try {
    const { tenantId } = await requireAdminOrConsultant();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("student_record_interview_questions")
      .select("question, question_type, difficulty, suggested_answer")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId!)
      .order("question_type")
      .order("difficulty")
      .limit(20);
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    logActionError({ ...LOG_CTX, action: "fetchInterviewQuestions" }, error, { studentId });
    return [];
  }
}
