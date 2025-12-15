/**
 * 성적 대시보드 관련 공통 유틸리티 함수
 * 
 * 여러 컴포넌트에서 반복되는 로직을 통합하여 유지보수성을 향상시킵니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TenantContext } from "@/lib/tenant/getTenantContext";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

/**
 * 학생 정보와 tenant_id를 함께 조회합니다.
 * 
 * @param supabase - Supabase 서버 클라이언트
 * @param studentId - 학생 ID
 * @returns 학생 정보 (tenant_id 포함) 또는 null
 */
export async function getStudentWithTenant(
  supabase: SupabaseServerClient,
  studentId: string
): Promise<{ id: string; tenant_id: string | null } | null> {
  const { data: student, error } = await supabase
    .from("students")
    .select("id, tenant_id")
    .eq("id", studentId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("[scoreDashboardUtils] 학생 조회 실패", {
      error: error.message,
      code: error.code,
      studentId,
    });
  }

  return student;
}

/**
 * effectiveTenantId를 결정합니다.
 * 
 * 우선순위: tenantContext.tenantId > student.tenant_id
 * 
 * @param tenantContext - 테넌트 컨텍스트 (nullable)
 * @param studentTenantId - 학생의 tenant_id (nullable)
 * @returns effectiveTenantId 또는 null
 */
export function getEffectiveTenantId(
  tenantContext: TenantContext | null,
  studentTenantId: string | null
): string | null {
  return tenantContext?.tenantId || studentTenantId || null;
}

/**
 * tenantId 불일치를 검증하고 경고를 출력합니다.
 * 
 * @param tenantContext - 테넌트 컨텍스트 (nullable)
 * @param studentTenantId - 학생의 tenant_id (nullable)
 * @param studentId - 학생 ID (로깅용)
 * @param contextName - 컨텍스트 이름 (로깅용, 예: "unified-dashboard")
 */
export function validateTenantIdMismatch(
  tenantContext: TenantContext | null,
  studentTenantId: string | null,
  studentId: string,
  contextName: string
): void {
  if (
    tenantContext?.tenantId &&
    studentTenantId &&
    tenantContext.tenantId !== studentTenantId
  ) {
    console.warn(`[${contextName}] tenant_id 불일치`, {
      contextTenantId: tenantContext.tenantId,
      studentTenantId,
      studentId,
    });
  }
}

/**
 * 성적 대시보드 에러를 처리하고 사용자 친화적인 메시지를 반환합니다.
 * 
 * @param error - 에러 객체
 * @param contextName - 컨텍스트 이름 (로깅용)
 * @returns 사용자 친화적인 에러 메시지
 */
export function handleScoreDashboardError(
  error: unknown,
  contextName: string
): string {
  console.error(`[${contextName}] 성적 대시보드 조회 실패`, error);

  if (error instanceof Error) {
    // API 호출 실패 메시지 파싱
    if (error.message.includes("404") || error.message.includes("Student not found")) {
      return "학생 정보를 찾을 수 없습니다.";
    }
    if (error.message.includes("403") || error.message.includes("Forbidden")) {
      return "접근 권한이 없습니다.";
    }
    if (error.message.includes("400") || error.message.includes("Tenant ID")) {
      return "기관 정보를 찾을 수 없습니다.";
    }
    return error.message;
  }

  return "알 수 없는 오류가 발생했습니다.";
}

/**
 * 성적 대시보드 데이터가 있는지 확인합니다.
 * 
 * @param internalAnalysis - 내신 분석 결과
 * @param mockAnalysis - 모의고사 분석 결과
 * @returns 데이터 존재 여부
 */
export function hasScoreDashboardData(
  internalAnalysis: {
    totalGpa: number | null;
    subjectStrength: Record<string, number>;
  },
  mockAnalysis: {
    avgPercentile: number | null;
    recentExam: { examDate: string; examTitle: string } | null;
  }
): boolean {
  return (
    internalAnalysis.totalGpa !== null ||
    mockAnalysis.avgPercentile !== null ||
    Object.keys(internalAnalysis.subjectStrength).length > 0 ||
    mockAnalysis.recentExam !== null
  );
}

