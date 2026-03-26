// ============================================
// Phase D-3: 자동 배치 분석 + 스냅샷 저장 + 우회학과 연동
// 모의고사 DB → SuneungScores 변환 → 배치 판정 → 영속화
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { convertMockScoresToSuneung } from "./mock-score-converter";
import { analyzePlacement } from "./service";
import type { PlacementSummary, PlacementLevel } from "./types";

const LOG_CTX = { domain: "admission", action: "auto-placement" };

export interface AutoPlacementResult {
  snapshotId: string;
  examDate: string;
  summary: PlacementSummary;
  verdictCount: number;
}

/**
 * 모의고사 DB에서 최신 점수를 읽어 자동으로 배치 분석 실행 + 스냅샷 저장.
 *
 * @returns 결과 또는 null (모의고사 없음/점수 부족)
 */
export async function autoRunPlacement(
  studentId: string,
  tenantId: string,
): Promise<AutoPlacementResult | null> {
  // 1. 모의고사 → SuneungScores 변환
  const conversion = await convertMockScoresToSuneung(studentId, tenantId);
  if (!conversion) {
    logActionDebug(LOG_CTX, `학생 ${studentId}: 모의고사 데이터 없음`);
    return null;
  }

  const { scores, warnings, examDate } = conversion;

  // 최소 국어 + 수학 있어야 의미 있는 배치 분석 가능
  const hasMath = scores.mathCalculus != null || scores.mathGeometry != null || scores.mathStatistics != null;
  if (scores.korean == null && !hasMath) {
    logActionDebug(LOG_CTX, `학생 ${studentId}: 국어/수학 모두 없음 — 스킵 (warnings: ${warnings.join(", ")})`);
    return null;
  }

  // 2. 배치 분석 실행
  let analysisResult;
  try {
    analysisResult = await analyzePlacement(studentId, scores);
  } catch (err) {
    logActionError(LOG_CTX, err, { studentId });
    return null;
  }

  // 3. 스냅샷 저장
  const supabase = await createSupabaseServerClient();

  const { data: snapshot, error: insertErr } = await supabase
    .from("student_placement_snapshots")
    .upsert({
      student_id: studentId,
      tenant_id: tenantId,
      exam_type: "pipeline_auto",
      exam_date: examDate,
      data_year: analysisResult.dataYear,
      input_scores: scores,
      result: analysisResult,
      summary: analysisResult.summary,
      verdict_count: analysisResult.verdicts.length,
    }, {
      onConflict: "student_id,tenant_id,exam_type,exam_date",
    })
    .select("id")
    .single();

  if (insertErr) {
    logActionError({ ...LOG_CTX, action: "auto-placement.save" }, insertErr, { studentId });
    return null;
  }

  logActionDebug(LOG_CTX, `학생 ${studentId}: 배치 분석 완료 — ${analysisResult.verdicts.length}개 대학, ${examDate}`);

  return {
    snapshotId: snapshot.id,
    examDate,
    summary: analysisResult.summary,
    verdictCount: analysisResult.verdicts.length,
  };
}

/**
 * 배치 분석 결과를 우회학과 후보의 placement_grade에 백필.
 *
 * bypass_major_candidates.candidate_department의 university_name을
 * PlacementVerdict의 universityName과 매칭하여 배치 등급 업데이트.
 */
export async function backfillPlacementGrades(
  studentId: string,
  tenantId: string,
  schoolYear: number,
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  // 1. 최신 배치 스냅샷 조회
  const { data: snap } = await supabase
    .from("student_placement_snapshots")
    .select("result")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snap?.result) return 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verdicts = (snap.result as any)?.verdicts as Array<{
    universityName: string;
    level: PlacementLevel;
  }> ?? [];

  if (verdicts.length === 0) return 0;

  // university_name → level 매핑 (동일 대학 여러 학과 → 가장 좋은 등급)
  const univBestLevel = new Map<string, PlacementLevel>();
  const levelPriority: Record<PlacementLevel, number> = {
    safe: 5, possible: 4, bold: 3, unstable: 2, danger: 1,
  };

  for (const v of verdicts) {
    const existing = univBestLevel.get(v.universityName);
    if (!existing || levelPriority[v.level] > levelPriority[existing]) {
      univBestLevel.set(v.universityName, v.level);
    }
  }

  // 2. 우회학과 후보 조회
  const { data: candidates } = await supabase
    .from("bypass_major_candidates")
    .select("id, candidate_department:university_departments!bypass_major_candidates_candidate_department_id_fkey(university_name)")
    .eq("student_id", studentId)
    .eq("school_year", schoolYear);

  if (!candidates || candidates.length === 0) return 0;

  // 3. 배치 등급 백필 — level별 배치 UPDATE (N+1 방지)
  const idsByLevel = new Map<PlacementLevel, string[]>();

  for (const c of candidates) {
    // Supabase FK JOIN은 단일 객체 또는 배열 반환 가능
    const deptRaw = c.candidate_department;
    const dept = Array.isArray(deptRaw) ? deptRaw[0] : deptRaw;
    const univName = (dept as { university_name: string } | null)?.university_name;
    if (!univName) continue;

    const level = univBestLevel.get(univName);
    if (!level) continue;

    const ids = idsByLevel.get(level) ?? [];
    ids.push(c.id);
    idsByLevel.set(level, ids);
  }

  let updated = 0;
  for (const [level, ids] of idsByLevel) {
    const { count } = await supabase
      .from("bypass_major_candidates")
      .update({ placement_grade: level })
      .in("id", ids);
    updated += count ?? ids.length;
  }

  if (updated > 0) {
    logActionDebug(LOG_CTX, `학생 ${studentId}: ${updated}건 placement_grade 백필`);
  }

  return updated;
}
