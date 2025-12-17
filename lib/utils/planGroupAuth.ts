/**
 * 플랜 그룹 관련 인증/권한 체크 공통 함수
 */

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getPlanGroupById, getPlanGroupByIdForAdmin } from "@/lib/data/planGroups";
import { AppError, ErrorCode } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import type { PlanGroup } from "@/lib/types/plan";

/**
 * 플랜 그룹 조회를 위한 학생 ID 결정
 * 관리자/컨설턴트 모드와 학생 모드를 모두 지원
 * 
 * @param groupId - 플랜 그룹 ID (null이면 템플릿 모드)
 * @param studentId - 학생 ID (관리자/컨설턴트 모드에서 사용)
 * @returns targetStudentId와 group 정보
 */
export async function resolveTargetStudentId(
  groupId: string | null,
  studentId?: string
): Promise<{
  targetStudentId: string;
  group?: PlanGroup;
  tenantId: string;
}> {
  const { role, userId } = await getCurrentUserRole();
  const tenantContext = await getTenantContext();

  if (!userId) {
    throw new AppError(
      "로그인이 필요합니다.",
      ErrorCode.UNAUTHORIZED,
      401,
      true
    );
  }

  if (!tenantContext?.tenantId) {
    throw new AppError(
      "기관 정보를 찾을 수 없습니다.",
      ErrorCode.NOT_FOUND,
      404,
      true
    );
  }

  // 관리자/컨설턴트 모드일 때는 studentId 파라미터 필수
  const isAdminOrConsultant = role === "admin" || role === "consultant";
  let targetStudentId: string;
  let group: PlanGroup | undefined;

  // 플랜 그룹 조회 (groupId가 있는 경우만)
  if (groupId) {
    if (isAdminOrConsultant) {
      // 관리자 모드: getPlanGroupByIdForAdmin 사용
      group = await getPlanGroupByIdForAdmin(groupId, tenantContext.tenantId);
      if (!group) {
        throw new AppError(
          "플랜 그룹을 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
      // 관리자 모드에서 studentId가 없으면 플랜 그룹에서 student_id 가져오기
      targetStudentId = studentId || group.student_id;
      if (!targetStudentId) {
        throw new AppError(
          "학생 ID를 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
    } else {
      // 학생 모드: 기존 로직
      group = await getPlanGroupById(
        groupId,
        userId,
        tenantContext.tenantId
      );
      if (!group) {
        throw new AppError(
          "플랜 그룹을 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
      targetStudentId = userId;
      // 기존 플랜 그룹인 경우 revalidate
      revalidatePath(`/plan/group/${groupId}/edit`);
    }
  } else {
    // groupId가 없는 경우
    if (isAdminOrConsultant) {
      // 관리자 모드: studentId 파라미터 필수
      if (!studentId) {
        throw new AppError(
          "학생 ID가 필요합니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }
      targetStudentId = studentId;
    } else {
      // 학생 모드: 현재 사용자 ID 사용
      targetStudentId = userId;
    }
  }

  return {
    targetStudentId,
    group,
    tenantId: tenantContext.tenantId,
  };
}

