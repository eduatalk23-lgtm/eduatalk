import { AppError, ErrorCode } from "@/lib/errors";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getPlanGroupWithDetails,
  getPlanGroupWithDetailsForAdmin,
} from "@/lib/data/planGroups";
import { requireTenantContext } from "@/lib/tenant/requireTenantContext";
import type {
  PlanGroup,
  PlanContent,
  PlanExclusion,
  AcademySchedule,
} from "@/lib/types/plan";
import {
  selectClientForStudentQuery,
  ensureAdminClient,
  type SupabaseClientForStudentQuery,
} from "@/lib/supabase/clientSelector";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PlanGroupAllowedRole = "student" | "admin" | "consultant";

export type PlanGroupAccessContext = {
  user: CurrentUser;
  role: PlanGroupAllowedRole;
  tenantId: string | null;
};

const allowedRoles: PlanGroupAllowedRole[] = ["student", "admin", "consultant"];

/**
 * 플랜 그룹 관련 액션을 실행할 수 있는 권한을 검증합니다.
 */
export async function verifyPlanGroupAccess(): Promise<PlanGroupAccessContext> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (!allowedRoles.includes(user.role as PlanGroupAllowedRole)) {
    throw new AppError(
      "학생 권한이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      403,
      true
    );
  }

  return {
    user,
    role: user.role as PlanGroupAllowedRole,
    tenantId: user.tenantId ?? null,
  };
}

/**
 * 역할에 따라 적절한 플랜 그룹 데이터를 조회합니다.
 */
export async function getPlanGroupWithDetailsByRole(
  groupId: string,
  userId: string,
  role: PlanGroupAllowedRole,
  tenantId?: string | null
): Promise<{
  group: PlanGroup | null;
  contents: PlanContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
}> {
  if (role === "admin" || role === "consultant") {
    const resolvedTenantId =
      tenantId ?? (await requireTenantContext()).tenantId;

    if (!resolvedTenantId) {
      throw new AppError(
        "기관 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    return getPlanGroupWithDetailsForAdmin(groupId, resolvedTenantId);
  }

  return getPlanGroupWithDetails(groupId, userId);
}

/**
 * 역할에 따라 실제 사용할 studentId를 반환합니다.
 */
export function getStudentIdForPlanGroup(
  group: PlanGroup,
  userId: string,
  role: PlanGroupAllowedRole
): string {
  if (role === "admin" || role === "consultant") {
    return group.student_id;
  }
  return userId;
}

/**
 * 상태 체크를 우회해야 하는지 여부를 반환합니다.
 */
export function shouldBypassStatusCheck(
  role: PlanGroupAllowedRole,
  planType: string | null
): boolean {
  return role === "admin" || role === "consultant" || planType === "camp";
}

/**
 * 학생 데이터를 조회할 때 사용할 Supabase 클라이언트를 반환합니다.
 * 관리자/컨설턴트가 다른 학생 데이터를 조회할 경우 Admin 클라이언트를 사용합니다.
 */
export async function getSupabaseClientForStudent(
  studentId: string,
  currentUserId: string,
  role: PlanGroupAllowedRole
) {
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  return selectClientForStudentQuery(
    studentId,
    currentUserId,
    isAdminOrConsultant
  );
}

/**
 * 플랜 생성/조회 작업에 필요한 클라이언트를 반환합니다.
 * - 관리자/컨설턴트가 다른 학생의 플랜을 생성/조회할 경우 Admin 클라이언트 사용
 * - 그 외에는 기본 서버 클라이언트 사용
 */
export async function getClientForPlanOperation(
  studentId: string,
  currentUserId: string,
  role: PlanGroupAllowedRole
): Promise<SupabaseClientForStudentQuery> {
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const isOtherStudent = isAdminOrConsultant && studentId !== currentUserId;

  if (isOtherStudent) {
    return ensureAdminClient();
  }

  return createSupabaseServerClient();
}

/**
 * 상태 체크를 우회해야 하는지 여부를 반환합니다.
 * 캠프 모드이거나 관리자/컨설턴트 권한인 경우 상태 체크를 우회합니다.
 */
export function canBypassStatusCheck(
  role: PlanGroupAllowedRole,
  planType: string | null | undefined
): boolean {
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  const isCampMode = planType === "camp";
  return isAdminOrConsultant || isCampMode;
}

/**
 * 다른 학생의 데이터를 조회하는지 여부를 반환합니다.
 */
export function isOtherStudent(
  studentId: string,
  currentUserId: string,
  role: PlanGroupAllowedRole
): boolean {
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  return isAdminOrConsultant && studentId !== currentUserId;
}

