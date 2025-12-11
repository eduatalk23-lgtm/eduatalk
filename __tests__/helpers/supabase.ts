/**
 * 통합 테스트용 Supabase 헬퍼 함수
 * 
 * 실제 데이터베이스 연결이 필요한 통합 테스트에서 사용합니다.
 * 
 * 사용 전 설정:
 * 1. .env.test 파일에 테스트용 Supabase 인증 정보 설정
 * 2. 테스트용 Supabase 프로젝트에 마이그레이션 실행
 * 3. 테스트 데이터베이스 초기화
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 테스트용 Supabase Admin 클라이언트 생성
 * 
 * 주의: 실제 데이터베이스에 연결되므로 테스트 환경에서만 사용
 */
export function createTestSupabaseClient() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "테스트 클라이언트는 테스트 환경에서만 사용할 수 있습니다."
    );
  }

  return createSupabaseAdminClient();
}

/**
 * 테스트 데이터 정리
 * 
 * 테스트 후 생성된 데이터를 정리합니다.
 */
export async function cleanupTestData(
  tenantId: string,
  studentId: string,
  blockSetId?: string,
  campTemplateId?: string
): Promise<void> {
  const supabase = createTestSupabaseClient();
  if (!supabase) {
    throw new Error("테스트 Supabase 클라이언트를 생성할 수 없습니다.");
  }

  // 플랜 그룹 삭제
  await supabase
    .from("plan_groups")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId);

  // 블록 세트 삭제
  if (blockSetId) {
    await supabase.from("block_sets").delete().eq("id", blockSetId);
  }

  // 캠프 템플릿 삭제
  if (campTemplateId) {
    await supabase
      .from("camp_templates")
      .delete()
      .eq("id", campTemplateId);
  }

  // 학생 삭제
  await supabase.from("students").delete().eq("id", studentId);

  // 테넌트 삭제
  await supabase.from("tenants").delete().eq("id", tenantId);
}

/**
 * 테스트용 테넌트 생성
 */
export async function createTestTenant(name: string = "테스트 테넌트"): Promise<string> {
  const supabase = createTestSupabaseClient();
  if (!supabase) {
    throw new Error("테스트 Supabase 클라이언트를 생성할 수 없습니다.");
  }

  const { data, error } = await supabase
    .from("tenants")
    .insert({
      name,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`테스트 테넌트 생성 실패: ${error?.message || "Unknown error"}`);
  }

  return data.id;
}

/**
 * 테스트용 학생 생성
 */
export async function createTestStudent(
  tenantId: string,
  name: string = "테스트 학생"
): Promise<string> {
  const supabase = createTestSupabaseClient();
  if (!supabase) {
    throw new Error("테스트 Supabase 클라이언트를 생성할 수 없습니다.");
  }

  const { data, error } = await supabase
    .from("students")
    .insert({
      tenant_id: tenantId,
      name,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`테스트 학생 생성 실패: ${error?.message || "Unknown error"}`);
  }

  return data.id;
}

/**
 * 테스트용 블록 세트 생성
 */
export async function createTestBlockSet(
  tenantId: string,
  studentId: string,
  name: string = "테스트 블록 세트"
): Promise<string> {
  const supabase = createTestSupabaseClient();
  if (!supabase) {
    throw new Error("테스트 Supabase 클라이언트를 생성할 수 없습니다.");
  }

  const { data, error } = await supabase
    .from("block_sets")
    .insert({
      tenant_id: tenantId,
      student_id: studentId,
      name,
      blocks: [],
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`테스트 블록 세트 생성 실패: ${error?.message || "Unknown error"}`);
  }

  return data.id;
}

