import { AppError, ErrorCode } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type SupabaseClientForStudentQuery =
  | SupabaseServerClient
  | SupabaseAdminClient;

/**
 * Service Role Key 기반 Admin 클라이언트를 보장합니다.
 */
export function ensureAdminClient(): SupabaseAdminClient {
  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    throw new AppError(
      "Admin 클라이언트를 생성할 수 없습니다. 환경 변수를 확인해주세요.",
      ErrorCode.INTERNAL_ERROR,
      500,
      false
    );
  }

  return adminClient;
}

/**
 * 학생 데이터 조회 시 사용할 Supabase 클라이언트를 선택합니다.
 * - 관리자/컨설턴트가 다른 학생 데이터를 조회할 경우 Admin 클라이언트 사용
 * - 그 외에는 기본 서버 클라이언트 사용
 */
export async function selectClientForStudentQuery(
  studentId: string,
  currentUserId: string,
  isAdminOrConsultant: boolean
): Promise<SupabaseClientForStudentQuery> {
  const isOtherStudent = isAdminOrConsultant && studentId !== currentUserId;

  if (isOtherStudent) {
    return ensureAdminClient();
  }

  return createSupabaseServerClient();
}

