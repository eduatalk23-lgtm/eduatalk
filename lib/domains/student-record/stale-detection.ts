// ============================================
// Stale Detection — 엣지/파이프라인 변경 감지
// Phase E3: 레코드 수정 시 관련 엣지 stale 마킹
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeContentHash } from "./content-hash";
import { markEdgesStale } from "./edge-repository";

/**
 * 레코드 저장 후 관련 엣지를 stale로 마킹 (fire-and-forget safe)
 * 실패해도 무시 — 엣지가 없으면 자연스럽게 0건 반환
 */
export async function markRelatedEdgesStale(recordId: string): Promise<void> {
  try {
    await markEdgesStale(recordId, "source_record_updated");
  } catch {
    // fire-and-forget: 실패해도 주요 저장 플로우에 영향 없음
  }
}

/**
 * 파이프라인의 content_hash와 현재 레코드 상태를 비교하여 stale 여부 반환
 */
export async function checkPipelineStaleness(
  studentId: string,
  tenantId: string,
): Promise<{ isStale: boolean; savedHash: string | null; currentHash: string }> {
  const supabase = await createSupabaseServerClient();

  // 1. 최신 파이프라인의 content_hash 조회
  const { data: pipeline } = await supabase
    .from("student_record_analysis_pipelines")
    .select("content_hash")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const savedHash = pipeline?.content_hash ?? null;

  // 2. 현재 레코드 해시 계산
  const [seteks, changche, haengteuk] = await Promise.all([
    supabase
      .from("student_record_seteks")
      .select("id, updated_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("student_record_changche")
      .select("id, updated_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
    supabase
      .from("student_record_haengteuk")
      .select("id, updated_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId),
  ]);

  const allRecords = [
    ...(seteks.data ?? []),
    ...(changche.data ?? []),
    ...(haengteuk.data ?? []),
  ].map((r) => ({ id: r.id, updated_at: r.updated_at }));

  const currentHash = computeContentHash(allRecords);

  return {
    isStale: savedHash !== null && savedHash !== currentHash,
    savedHash,
    currentHash,
  };
}
