// ============================================
// Phase 3 Auto-Bootstrap: k≥1 학생의 기존 탐구 요약 빌더
//
// Bootstrap 의 main_exploration seed LLM 호출 시 학생이 이미 쌓은 탐구 경험을
// 주입하여 "k=0 일반 초안" 이 아닌 "이 학생 개별화 초안" 을 얻기 위함.
//
// 키워드 소스 우선순위:
//   1. student_record_storylines (title + keywords) — synthesis 완료한 학년이 있을 때 가장 구체적
//   2. student_record_activity_tags 빈도 상위 (competency_item) — storyline 없어도 k≥1 감지
//   3. 둘 다 없으면 null → k=0 경로로 Bootstrap 진입 (summary 주입 없음)
//
// 과목 소스: student_record_seteks (soft-deleted 제외) 의 subject.name 유니크.
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MainExplorationRecordSummary } from "../../llm/prompts/mainExplorationSeed";

const MAX_KEYWORDS = 10;
const MAX_SUBJECTS = 10;

export async function buildRecordSummaryForSeed(
  studentId: string,
  tenantId: string,
  supabase: SupabaseClient,
): Promise<MainExplorationRecordSummary | null> {
  const [storylineRes, tagRes, setekRes] = await Promise.all([
    supabase
      .from("student_record_storylines")
      .select("title, keywords")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
    supabase
      .from("student_record_activity_tags")
      .select("competency_item")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("source", "ai"),
    supabase
      .from("student_record_seteks")
      .select("subject:subject_id(name)")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
  ]);

  const storylines = (storylineRes.data ?? []) as Array<{
    title: string | null;
    keywords: string[] | null;
  }>;
  const tags = (tagRes.data ?? []) as Array<{ competency_item: string }>;
  const seteks = (setekRes.data ?? []) as Array<{
    subject: { name?: string | null } | null;
  }>;

  // k=0 판정: storyline/tag 둘 다 0 이면 기존 탐구 없음으로 간주
  if (storylines.length === 0 && tags.length === 0) {
    return null;
  }

  // 키워드: storyline 우선, 없으면 tag 빈도
  let keywords: string[] = [];
  if (storylines.length > 0) {
    const pool: string[] = [];
    for (const s of storylines) {
      if (s.title) pool.push(s.title);
      if (Array.isArray(s.keywords)) pool.push(...s.keywords.filter(Boolean));
    }
    keywords = [...new Set(pool)].slice(0, MAX_KEYWORDS);
  }
  if (keywords.length === 0 && tags.length > 0) {
    const freq = new Map<string, number>();
    for (const t of tags) {
      freq.set(t.competency_item, (freq.get(t.competency_item) ?? 0) + 1);
    }
    keywords = [...freq.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, MAX_KEYWORDS)
      .map(([k]) => k);
  }

  // 과목 이름 유니크
  const subjectAreas = [
    ...new Set(
      seteks
        .map((s) => s.subject?.name ?? null)
        .filter((n): n is string => !!n && n.trim().length > 0),
    ),
  ].slice(0, MAX_SUBJECTS);

  // 최종 가드: 둘 다 비면 null
  if (keywords.length === 0 && subjectAreas.length === 0) {
    return null;
  }

  return { keywords, subjectAreas };
}
