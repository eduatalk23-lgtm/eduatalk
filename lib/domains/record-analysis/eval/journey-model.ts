// ============================================
// C1(2026-04-16) — Journey Model 통합 뷰
//
// WHO(정체성) + WHAT(설계 청사진) + WHERE(실측 수렴) + GAP(Bridge 제안)
// 4축을 DB에서 조립하여 한 구조체로 반환. Phase 6 후 통합 뷰 소비자용.
//
// LLM 호출 없음. 순수 데이터 어셈블리.
//
// 소비자:
//   - UI 통합 패널 (학생 대시보드)
//   - Prompt 주입 (diagnosis/strategy/roadmap 이미 각자 주입하지만,
//     새 태스크가 WHO+WHAT+WHERE+GAP 모두 필요할 때 이 어셈블러 사용)
//   - Export (PDF/보고서)
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersistedHyperedge } from "@/lib/domains/student-record/repository/hyperedge-repository";

// ============================================
// 타입
// ============================================

export interface JourneyWho {
  studentName?: string;
  grade?: number;
  targetMajor?: string;
  careerField?: string;
  identityKeywords?: string[];
  /** H2 profile card narrative summary */
  profileNarrative?: string;
}

export interface JourneyWhat {
  /** blueprint 하이퍼엣지 (top-down 수렴 설계) */
  convergences: Array<{
    grade: number | null;
    themeLabel: string;
    memberLabels: string[];
    sharedCompetencies: string[];
  }>;
  overarchingTheme?: string;
}

export interface JourneyWhere {
  /** analysis 하이퍼엣지 (bottom-up 실측 수렴) */
  convergences: Array<{
    grade: number | null;
    themeLabel: string;
    memberLabels: string[];
    sharedCompetencies: string[];
  }>;
  /** projected 하이퍼엣지 (설계 모드 가안 분석 결과) */
  projectedConvergences: Array<{
    grade: number | null;
    themeLabel: string;
    memberLabels: string[];
    sharedCompetencies: string[];
  }>;
}

export interface JourneyGap {
  /** bridge 하이퍼엣지 (gap → action) */
  bridges: Array<{
    themeLabel: string;
    evidence: string | null;
    urgencyHint: "high" | "medium" | "low" | null;
  }>;
}

export interface JourneyModel {
  who: JourneyWho;
  what: JourneyWhat;
  where: JourneyWhere;
  gap: JourneyGap;
  /** 4축 모두 비어있으면 empty=true */
  empty: boolean;
  /** 어셈블리 시각 */
  assembledAt: string;
}

// ============================================
// 어셈블러
// ============================================

export interface BuildJourneyModelInput {
  studentId: string;
  tenantId: string;
  /** 호출자가 이미 보유한 supabase 클라이언트 재사용 (없으면 server 클라이언트 생성) */
  supabase?: SupabaseClient;
}

/**
 * 학생의 WHO/WHAT/WHERE/GAP 4축 데이터를 DB에서 조립.
 *
 * - profile_cards: 최신 source='ai' 카드 1건
 * - students: 학생 기본 정보
 * - hyperedges: blueprint/analysis/projected/bridge 4종 parallel fetch
 *
 * 실패/누락 필드는 모두 undefined/빈 배열로 graceful degradation.
 */
export async function buildJourneyModel(
  input: BuildJourneyModelInput,
): Promise<JourneyModel> {
  const { studentId, tenantId } = input;
  const supabase =
    input.supabase ??
    (await (async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      return createSupabaseServerClient();
    })());

  const [studentRow, profileCardRow, mainExplorationRow, bpHyperedges, anHyperedges, projHyperedges, brHyperedges] =
    await Promise.all([
      supabase
        .from("students")
        .select("grade, target_major, user_profiles(name)")
        .eq("id", studentId)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("student_record_profile_cards")
        .select("interest_consistency")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .eq("source", "ai")
        .order("target_grade", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("student_main_explorations")
        .select("career_field, theme_keywords")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("scope", "overall")
        .limit(1)
        .maybeSingle(),
      findHyperedgesByContext(supabase, studentId, tenantId, "blueprint"),
      findHyperedgesByContext(supabase, studentId, tenantId, "analysis"),
      findHyperedgesByContext(supabase, studentId, tenantId, "projected"),
      findHyperedgesByContext(supabase, studentId, tenantId, "bridge"),
    ]);

  // ── WHO ──
  const student = studentRow.data as
    | { grade?: number; target_major?: string; user_profiles?: { name?: string } | null }
    | null;
  const profileCardJson = profileCardRow.data as
    | { interest_consistency?: { narrative?: string } | null }
    | null;
  const mainExp = mainExplorationRow.data as
    | { career_field?: string | null; theme_keywords?: string[] | null }
    | null;
  const who: JourneyWho = {
    studentName: student?.user_profiles?.name,
    grade: student?.grade,
    targetMajor: student?.target_major,
    careerField: mainExp?.career_field ?? undefined,
    identityKeywords: mainExp?.theme_keywords ?? undefined,
    profileNarrative: profileCardJson?.interest_consistency?.narrative ?? undefined,
  };

  // ── WHAT (blueprint) ──
  const what: JourneyWhat = {
    convergences: bpHyperedges.map(hyperedgeToConvergence),
  };

  // ── WHERE (analysis + projected) ──
  const where: JourneyWhere = {
    convergences: anHyperedges.map(hyperedgeToConvergence),
    projectedConvergences: projHyperedges.map(hyperedgeToConvergence),
  };

  // ── GAP (bridge) ──
  const gap: JourneyGap = {
    bridges: brHyperedges.map((he) => ({
      themeLabel: he.theme_label,
      evidence: he.evidence,
      urgencyHint: extractUrgencyHint(he.evidence),
    })),
  };

  const empty =
    what.convergences.length === 0 &&
    where.convergences.length === 0 &&
    where.projectedConvergences.length === 0 &&
    gap.bridges.length === 0;

  return {
    who,
    what,
    where,
    gap,
    empty,
    assembledAt: new Date().toISOString(),
  };
}

// ============================================
// 마크다운 렌더러 (프롬프트 주입용)
// ============================================

/**
 * Journey Model을 프롬프트 주입 가능한 마크다운 섹션으로 변환.
 * empty=true 이면 빈 문자열 반환.
 */
export function renderJourneyModelMarkdown(model: JourneyModel): string {
  if (model.empty) return "";

  const lines: string[] = ["## 통합 여정 모델 (WHO/WHAT/WHERE/GAP)"];
  lines.push("");

  // WHO
  const whoParts: string[] = [];
  if (model.who.studentName) whoParts.push(`${model.who.studentName}`);
  if (model.who.grade) whoParts.push(`${model.who.grade}학년`);
  if (model.who.targetMajor) whoParts.push(`목표 ${model.who.targetMajor}`);
  if (model.who.careerField) whoParts.push(`진로 ${model.who.careerField}`);
  if (whoParts.length > 0) {
    lines.push(`### WHO (정체성)`);
    lines.push(`- ${whoParts.join(" · ")}`);
    if (model.who.identityKeywords?.length) {
      lines.push(`- 키워드: ${model.who.identityKeywords.join(", ")}`);
    }
    if (model.who.profileNarrative) {
      lines.push(`- ${model.who.profileNarrative}`);
    }
    lines.push("");
  }

  // WHAT (blueprint)
  if (model.what.convergences.length > 0) {
    lines.push(`### WHAT (설계 청사진 — Blueprint 수렴)`);
    for (const c of model.what.convergences) {
      const gradeLabel = c.grade ? `${c.grade}학년 ` : "";
      lines.push(`- ${gradeLabel}"${c.themeLabel}": ${c.memberLabels.join(", ")}`);
    }
    lines.push("");
  }

  // WHERE (analysis + projected)
  if (model.where.convergences.length > 0 || model.where.projectedConvergences.length > 0) {
    lines.push(`### WHERE (실측 수렴)`);
    for (const c of model.where.convergences) {
      const gradeLabel = c.grade ? `${c.grade}학년 ` : "";
      lines.push(`- ${gradeLabel}"${c.themeLabel}": ${c.memberLabels.join(", ")}`);
    }
    for (const c of model.where.projectedConvergences) {
      const gradeLabel = c.grade ? `${c.grade}학년 ` : "";
      lines.push(`- [설계] ${gradeLabel}"${c.themeLabel}": ${c.memberLabels.join(", ")}`);
    }
    lines.push("");
  }

  // GAP (bridge)
  if (model.gap.bridges.length > 0) {
    lines.push(`### GAP (Bridge — 설계와 실측의 격차)`);
    for (const b of model.gap.bridges.slice(0, 8)) {
      const urgency = b.urgencyHint ? `[${b.urgencyHint}] ` : "";
      lines.push(`- ${urgency}"${b.themeLabel}"${b.evidence ? ` — ${b.evidence}` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================
// 내부 헬퍼
// ============================================

async function findHyperedgesByContext(
  supabase: SupabaseClient,
  studentId: string,
  tenantId: string,
  context: string,
): Promise<PersistedHyperedge[]> {
  const { data } = await supabase
    .from("student_record_hyperedges")
    .select("*")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("edge_context", context)
    .eq("is_stale", false);
  return (data ?? []) as PersistedHyperedge[];
}

function hyperedgeToConvergence(he: PersistedHyperedge): {
  grade: number | null;
  themeLabel: string;
  memberLabels: string[];
  sharedCompetencies: string[];
} {
  const gradeFromMembers = he.members?.[0]?.grade ?? null;
  return {
    grade: typeof gradeFromMembers === "number" ? gradeFromMembers : null,
    themeLabel: he.theme_label,
    memberLabels: (he.members ?? []).map((m) => m.label),
    sharedCompetencies: he.shared_competencies ?? [],
  };
}

function extractUrgencyHint(evidence: string | null): "high" | "medium" | "low" | null {
  if (!evidence) return null;
  if (/\b(high|긴급|시급)\b/i.test(evidence)) return "high";
  if (/\b(medium|중간)\b/i.test(evidence)) return "medium";
  if (/\b(low|낮음)\b/i.test(evidence)) return "low";
  return null;
}
