/**
 * 연결 코드 관련 유틸리티 함수
 * 
 * 연결 코드 검증 및 생성 관련 공통 함수
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 연결 코드 검증 (회원가입 시 사용)
 * 
 * @param connectionCode - 연결 코드
 * @returns 학생 ID 또는 에러
 */
export async function validateConnectionCode(
  connectionCode: string
): Promise<{
  success: boolean;
  studentId?: string;
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();

  // 코드 형식 검증
  if (!connectionCode.match(/^STU-[A-Z0-9]{4}-[A-Z0-9]{4}$/)) {
    return { success: false, error: "연결 코드 형식이 올바르지 않습니다." };
  }

  // 코드 조회
  const { data, error } = await supabase
    .from("student_connection_codes")
    .select("student_id, expires_at, used_at")
    .eq("connection_code", connectionCode)
    .maybeSingle();

  if (error) {
    console.error("[connectionCodeUtils] 연결 코드 조회 실패", error);
    return { success: false, error: "연결 코드를 확인할 수 없습니다." };
  }

  if (!data) {
    return { success: false, error: "유효하지 않은 연결 코드입니다." };
  }

  // 만료 확인
  const expiresAt = new Date(data.expires_at);
  if (expiresAt < new Date()) {
    return { success: false, error: "만료된 연결 코드입니다." };
  }

  // 사용 여부 확인
  if (data.used_at) {
    return { success: false, error: "이미 사용된 연결 코드입니다." };
  }

  return {
    success: true,
    studentId: data.student_id,
  };
}

