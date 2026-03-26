// ============================================
// Phase C-4: 피드백 CRUD + 패턴 쿼리
// bypass_recommendation_feedback 테이블 관리
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ─── 타입 ──────────────────────────────────

export type FeedbackAction = "shortlist" | "reject" | "select";

export interface FeedbackInput {
  studentId: string;
  tenantId: string;
  candidateId: string | null;
  departmentId: string | null;
  action: FeedbackAction;
  reason: string | null;
  consultantId: string;
  /** 행동 시점 학생 역량 스냅샷 (콜드스타트 패턴용) */
  competencyProfile: Record<string, string> | null;
  /** 학과 mid_classification (클러스터링용) */
  midClassification: string | null;
}

export interface FeedbackEntry {
  id: string;
  studentId: string;
  candidateId: string | null;
  departmentId: string | null;
  action: FeedbackAction;
  reason: string | null;
  consultantId: string | null;
  midClassification: string | null;
  createdAt: string;
}

export interface FeedbackPattern {
  departmentId: string;
  departmentName: string;
  universityName: string;
  midClassification: string;
  selectCount: number;
  shortlistCount: number;
  rejectCount: number;
  /** 최근 select 날짜 */
  lastSelectedAt: string | null;
}

// ─── CRUD ──────────────────────────────────

/** 피드백 저장 */
export async function saveFeedback(input: FeedbackInput): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("bypass_recommendation_feedback")
    .insert({
      student_id: input.studentId,
      tenant_id: input.tenantId,
      candidate_id: input.candidateId,
      department_id: input.departmentId,
      action: input.action,
      reason: input.reason,
      consultant_id: input.consultantId,
      competency_profile: input.competencyProfile,
      mid_classification: input.midClassification,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/** 학생의 피드백 이력 조회 */
export async function getStudentFeedbackHistory(
  studentId: string,
): Promise<FeedbackEntry[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("bypass_recommendation_feedback")
    .select("id, student_id, candidate_id, department_id, action, reason, consultant_id, mid_classification, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    candidateId: r.candidate_id,
    departmentId: r.department_id,
    action: r.action as FeedbackAction,
    reason: r.reason,
    consultantId: r.consultant_id,
    midClassification: r.mid_classification,
    createdAt: r.created_at,
  }));
}

// ─── 패턴 쿼리 (콜드스타트 해소) ─────────────

/**
 * 같은 mid_classification 내에서 컨설턴트들이 선택한 학과 패턴 조회.
 * select/shortlist 횟수가 높은 학과가 상위에.
 */
export async function getFeedbackPatterns(
  midClassification: string,
  limit = 10,
): Promise<FeedbackPattern[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Admin client 초기화 실패");

  // department_id별 action 집계
  const { data, error } = await supabase
    .from("bypass_recommendation_feedback")
    .select("department_id, action, created_at")
    .eq("mid_classification", midClassification)
    .not("department_id", "is", null)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return [];

  // 집계
  const deptMap = new Map<string, { select: number; shortlist: number; reject: number; lastSelected: string | null }>();
  for (const row of data) {
    const deptId = row.department_id as string;
    const entry = deptMap.get(deptId) ?? { select: 0, shortlist: 0, reject: 0, lastSelected: null };

    if (row.action === "select") {
      entry.select++;
      if (!entry.lastSelected) entry.lastSelected = row.created_at;
    } else if (row.action === "shortlist") {
      entry.shortlist++;
    } else if (row.action === "reject") {
      entry.reject++;
    }

    deptMap.set(deptId, entry);
  }

  // 학과 정보 조회
  const deptIds = [...deptMap.keys()];
  const { data: depts } = await supabase
    .from("university_departments")
    .select("id, department_name, university_name, mid_classification")
    .in("id", deptIds);

  const deptInfo = new Map<string, { name: string; univ: string; mid: string }>();
  for (const d of depts ?? []) {
    deptInfo.set(d.id, {
      name: d.department_name,
      univ: d.university_name,
      mid: d.mid_classification ?? "",
    });
  }

  // 결과 정렬 (select > shortlist 순)
  const patterns: FeedbackPattern[] = [];
  for (const [deptId, counts] of deptMap) {
    const info = deptInfo.get(deptId);
    if (!info) continue;

    patterns.push({
      departmentId: deptId,
      departmentName: info.name,
      universityName: info.univ,
      midClassification: info.mid,
      selectCount: counts.select,
      shortlistCount: counts.shortlist,
      rejectCount: counts.reject,
      lastSelectedAt: counts.lastSelected,
    });
  }

  patterns.sort((a, b) => {
    const aScore = a.selectCount * 3 + a.shortlistCount;
    const bScore = b.selectCount * 3 + b.shortlistCount;
    return bScore - aScore;
  });

  return patterns.slice(0, limit);
}
