/**
 * 성적 대시보드 쿼리 유틸리티 (레거시)
 * 
 * ⚠️ 주의: 이 파일은 레거시 대시보드(/scores/dashboard)에서만 사용됩니다.
 * 새로운 통합 대시보드(/scores/dashboard/unified)는 API 기반으로 구현되어 있습니다.
 * 
 * 새 기능 구현 시 /api/students/[id]/score-dashboard 를 사용하세요.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SchoolScoreRow, MockScoreRow } from "@/lib/types/legacyScoreTypes";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 내신 성적 조회 (레거시)
 * 
 * ⚠️ 이 함수는 student_internal_scores 테이블을 직접 조회합니다.
 * 새로운 코드에서는 /api/students/[id]/score-dashboard API를 사용하세요.
 * 
 * @deprecated 새로운 코드에서는 lib/api/scoreDashboard.ts 의 fetchScoreDashboard 사용
 * 
 * 대안: GET /api/students/[id]/score-dashboard?tenantId=...&grade=...&semester=...
 */
export async function fetchSchoolScores(
  studentId: string
): Promise<SchoolScoreRow[]> {
  try {
    const supabase = await createSupabaseServerClient();

    // tenant_id도 함께 조회 (RLS 정책 준수)
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) {
      console.warn("[dashboard] 사용자 정보 없음");
      return [];
    }

    // tenant_id 조회 (RLS 정책 준수)
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", studentId)
      .single();

    if (!student?.tenant_id) {
      console.warn("[dashboard] 학생의 tenant_id를 찾을 수 없음");
      return [];
    }

    const { data: scores, error } = await supabase
      .from("student_internal_scores")
      .select("*")
      .eq("student_id", studentId)
      .eq("tenant_id", student.tenant_id)
      .order("grade", { ascending: true })
      .order("semester", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[dashboard] 내신 성적 조회 실패", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        error,
      });
      return [];
    }

    return (scores as SchoolScoreRow[] | null) ?? [];
  } catch (err) {
    console.error("[dashboard] 내신 성적 조회 중 예외 발생", err);
    return [];
  }
}

/**
 * 모의고사 성적 조회 (레거시)
 * 
 * ⚠️ 이 함수는 student_mock_scores 테이블을 직접 조회합니다.
 * 새로운 코드에서는 /api/students/[id]/score-dashboard API를 사용하세요.
 * 
 * @deprecated 새로운 코드에서는 lib/api/scoreDashboard.ts 의 fetchScoreDashboard 사용
 * 
 * 대안: GET /api/students/[id]/score-dashboard?tenantId=...&grade=...&semester=...
 */
export async function fetchMockScores(
  studentId: string
): Promise<MockScoreRow[]> {
  try {
    const supabase = await createSupabaseServerClient();

    // tenant_id도 함께 조회 (RLS 정책 준수)
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user?.id) {
      console.warn("[dashboard] 사용자 정보 없음");
      return [];
    }

    // tenant_id 조회 (RLS 정책 준수)
    const { data: student } = await supabase
      .from("students")
      .select("tenant_id")
      .eq("id", studentId)
      .single();

    if (!student?.tenant_id) {
      console.warn("[dashboard] 학생의 tenant_id를 찾을 수 없음");
      return [];
    }

    const { data: scores, error } = await supabase
      .from("student_mock_scores")
      .select("*")
      .eq("student_id", studentId)
      .eq("tenant_id", student.tenant_id)
      .order("exam_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[dashboard] 모의고사 성적 조회 실패", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        error,
      });
      return [];
    }

    return (scores as MockScoreRow[] | null) ?? [];
  } catch (err) {
    console.error("[dashboard] 모의고사 성적 조회 중 예외 발생", err);
    return [];
  }
}

