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
 * 타인 접근 시 Admin 클라이언트, 아니면 Server 클라이언트를 선택하는 통합 함수
 * 
 * 관리자/컨설턴트가 다른 학생의 데이터를 조회할 경우 Admin 클라이언트 사용
 * 그 외에는 기본 서버 클라이언트 사용
 * 
 * @param targetStudentId - 대상 학생 ID
 * @param currentUserId - 현재 로그인한 사용자 ID
 * @param isAdminOrConsultant - 관리자/컨설턴트 여부
 * @returns Supabase 클라이언트
 */
export async function selectClientForCrossAccess(
  targetStudentId: string,
  currentUserId: string,
  isAdminOrConsultant: boolean
): Promise<SupabaseClientForStudentQuery> {
  const isOtherStudent = isAdminOrConsultant && targetStudentId !== currentUserId;

  if (isOtherStudent) {
    return ensureAdminClient();
  }

  return createSupabaseServerClient();
}


/**
 * RLS 우회가 필요한 작업을 위한 클라이언트 선택
 * 
 * @param options - 클라이언트 선택 옵션
 * @param options.forceAdmin - Admin 클라이언트 강제 사용 (기본값: true)
 * @param options.fallbackToServer - Admin 클라이언트가 없을 때 서버 클라이언트 사용 (기본값: true)
 * @returns Supabase 클라이언트 (Admin 우선, 없으면 서버 클라이언트)
 * 
 * @example
 * // SMS 로그 생성 시 (RLS 우회 필수)
 * const client = await getSupabaseClientForRLSBypass({
 *   forceAdmin: true,
 *   fallbackToServer: false
 * });
 * 
 * @example
 * // 일반적인 RLS 우회 (Admin 우선, 없으면 서버 클라이언트)
 * const client = await getSupabaseClientForRLSBypass();
 */
export async function getSupabaseClientForRLSBypass(
  options?: {
    forceAdmin?: boolean;
    fallbackToServer?: boolean;
  }
): Promise<SupabaseClientForStudentQuery> {
  const { forceAdmin = true, fallbackToServer = true } = options || {};

  if (forceAdmin) {
    const adminClient = createSupabaseAdminClient();
    if (adminClient) {
      return adminClient;
    }

    if (!fallbackToServer) {
      throw new AppError(
        "Admin 클라이언트를 생성할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY 환경 변수를 확인해주세요.",
        ErrorCode.INTERNAL_ERROR,
        500,
        false
      );
    }
  }

  return await createSupabaseServerClient();
}

/**
 * 학생이 자신의 데이터를 생성/수정할 때 사용하는 클라이언트 선택
 * 
 * RLS 정책이 학생의 INSERT/UPDATE를 허용하는 경우 서버 클라이언트 사용,
 * 그렇지 않은 경우 Admin 클라이언트 사용
 * 
 * @param studentId - 대상 학생 ID
 * @param currentUserId - 현재 로그인한 사용자 ID
 * @param operation - 작업 유형 ('insert' | 'update' | 'delete')
 * @param tableName - 테이블 이름 (RLS 정책 확인용)
 * @returns Supabase 클라이언트
 * 
 * @example
 * // 학생이 자신의 출석 기록 생성
 * const client = await getSupabaseClientForStudentOperation(
 *   studentId,
 *   currentUserId,
 *   'insert',
 *   'attendance_records'
 * );
 */
export async function getSupabaseClientForStudentOperation(
  studentId: string,
  currentUserId: string,
  operation: "insert" | "update" | "delete",
  tableName: string
): Promise<SupabaseClientForStudentQuery> {
  // 학생이 자신의 데이터를 수정하는 경우
  if (studentId === currentUserId) {
    // RLS 정책이 학생의 INSERT/UPDATE를 허용하는 테이블 목록
    // student_plan은 이미 정책이 있으므로 서버 클라이언트 사용 가능
    const tablesWithStudentPolicy = [
      "student_plan",
      // 향후 추가될 수 있는 테이블들
    ];

    // RLS 정책이 있는 테이블은 서버 클라이언트 사용
    if (tablesWithStudentPolicy.includes(tableName)) {
      return await createSupabaseServerClient();
    }

    // RLS 정책이 없는 테이블은 Admin 클라이언트 사용
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      // Admin 클라이언트가 없으면 서버 클라이언트로 시도
      // (RLS 정책이 추가되면 작동할 수 있음)
      return await createSupabaseServerClient();
    }
    return adminClient;
  }

  // 다른 학생의 데이터를 수정하는 경우 (관리자만 가능)
  return ensureAdminClient();
}

/**
 * 간단한 RLS 우회 클라이언트 선택 (Admin 우선, 없으면 서버)
 * 중복 패턴 통합용 헬퍼 함수
 * 
 * @returns Supabase 클라이언트
 * 
 * @example
 * // 중복 패턴 통합용
 * const supabase = await getClientForRLSBypass();
 */
export async function getClientForRLSBypass(): Promise<
  SupabaseClientForStudentQuery
> {
  return getSupabaseClientForRLSBypass({
    forceAdmin: false,
    fallbackToServer: true,
  });
}

