/**
 * 플랜 그룹 공통 유틸리티 함수
 */

import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { handleQueryError } from "@/lib/data/core/errorHandler";

/**
 * Supabase 클라이언트 생성 (Admin 모드 지원)
 */
export async function getSupabaseClient(useAdminClient: boolean = false): Promise<SupabaseClient> {
  if (useAdminClient) {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[getSupabaseClient] Admin 클라이언트를 생성할 수 없어 일반 클라이언트 사용");
      }
      return await createSupabaseServerClient();
    }
    return adminClient;
  }
  return await createSupabaseServerClient();
}

/**
 * Academy 찾기 또는 생성
 */
export async function getOrCreateAcademy(
  studentId: string,
  tenantId: string,
  academyName: string,
  travelTime: number = 60,
  useAdminClient: boolean = false
): Promise<{ id: string | null; error?: string }> {
  // RLS 우회가 필요한 경우 Admin 클라이언트 사용 (캠프 모드: 관리자가 학생 대신 생성)
  const supabase = await getSupabaseClient(useAdminClient);

  const { data: existingAcademy } = await supabase
    .from("academies")
    .select("id")
    .eq("student_id", studentId)
    .eq("name", academyName)
    .maybeSingle();

  if (existingAcademy) {
    return { id: existingAcademy.id };
  }

  const { data: newAcademy, error: academyError } = await supabase
    .from("academies")
    .insert({
      student_id: studentId,
      tenant_id: tenantId,
      name: academyName,
      travel_time: travelTime,
    })
    .select("id")
    .single();

  if (academyError || !newAcademy) {
    handleQueryError(academyError as PostgrestError | null, {
      context: "[data/planGroups] getOrCreateAcademy",
    });
    // 에러 메시지에 실제 DB 에러 원인 포함
    const errorDetail = academyError
      ? `(${academyError.code}) ${academyError.message}`
      : "알 수 없는 오류";
    return { id: null, error: errorDetail };
  }

  return { id: newAcademy.id };
}
