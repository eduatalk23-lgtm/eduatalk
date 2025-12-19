/**
 * 캠프 상태 관리 통합
 * 
 * 초대 상태와 플랜 그룹 상태를 조합하여 클라이언트가 이해하기 쉬운 단일 상태값 제공
 */

import type { CampInvitationStatus } from "@/lib/domains/camp/types";
import type { PlanStatus } from "@/lib/types/plan";

/**
 * 통합된 캠프 상태
 */
export type CampStatus =
  | "PENDING_FORM" // 초대 수락 전, 폼 작성 중
  | "WAITING_REVIEW" // 초대 수락, 플랜 생성 전
  | "READY_TO_START" // 플랜 생성 완료, 시작 전
  | "IN_PROGRESS" // 학습 중
  | "COMPLETED" // 완료됨
  | "PAUSED"; // 일시정지됨

/**
 * 캠프 상태 정보 (UI 렌더링용)
 */
export type CampStatusInfo = {
  status: CampStatus;
  label: string;
  color: string;
  description: string;
  canEdit: boolean;
  canStart: boolean;
  nextStep?: string;
  badgeClassName: string;
  linkHref?: string;
  linkLabel?: string;
};

/**
 * 초대 상태와 플랜 그룹 상태를 조합하여 통합 캠프 상태 반환
 * 
 * @param invitationStatus - 캠프 초대 상태
 * @param planGroupStatus - 플랜 그룹 상태 (null 가능)
 * @param hasPlans - 플랜이 생성되었는지 여부
 * @param isDraft - 플랜 그룹이 draft 상태인지 여부
 * @param planGroupId - 플랜 그룹 ID (null이면 플랜 그룹이 없음을 의미)
 * @returns 통합된 캠프 상태
 */
export function getCampStatus(
  invitationStatus: CampInvitationStatus,
  planGroupStatus: PlanStatus | null,
  hasPlans: boolean,
  isDraft: boolean = false,
  planGroupId: string | null = null
): CampStatus {
  // 1. 초대가 pending이고 플랜 그룹이 draft인 경우 (폼 작성 중)
  // 단, planGroupId가 있어야 함 (플랜 그룹이 실제로 존재해야 함)
  if (invitationStatus === "pending" && isDraft && planGroupId) {
    return "PENDING_FORM";
  }

  // 2. 초대가 accepted이고 플랜이 생성되지 않은 경우 (관리자 검토 중)
  if (invitationStatus === "accepted" && !hasPlans) {
    return "WAITING_REVIEW";
  }

  // 3. 플랜이 생성되었고 active 상태인 경우 (학습 중)
  if (hasPlans && planGroupStatus === "active") {
    return "IN_PROGRESS";
  }

  // 4. 플랜이 생성되었고 paused 상태인 경우 (일시정지)
  if (hasPlans && planGroupStatus === "paused") {
    return "PAUSED";
  }

  // 5. 플랜이 생성되었고 completed 상태인 경우 (완료)
  if (hasPlans && planGroupStatus === "completed") {
    return "COMPLETED";
  }

  // 6. 플랜이 생성되었고 saved/draft 상태인 경우 (시작 준비 완료)
  if (hasPlans && (planGroupStatus === "saved" || planGroupStatus === "draft")) {
    return "READY_TO_START";
  }

  // 기본값: 폼 작성 중 (pending 상태이지만 planGroupId가 없으면 이 조건에 도달하지 않음)
  // 초대 삭제 후 재생성 시 planGroupId가 null이므로 이 조건에 도달하지 않음
  if (invitationStatus === "pending") {
    // planGroupId가 없으면 "작성 중"이 아니라 다른 상태로 처리
    // 하지만 현재 상태 타입에는 "참여하기" 상태가 없으므로, 
    // UI에서는 planGroupId가 null이면 "참여하기" 버튼을 표시하도록 처리
    // 여기서는 일단 PENDING_FORM을 반환하되, UI에서 planGroupId를 확인하여 처리
    return "PENDING_FORM";
  }

  // 기본값: 관리자 검토 중 (accepted 상태)
  return "WAITING_REVIEW";
}

/**
 * 캠프 상태에 따른 UI 정보 반환
 * 
 * @param status - 통합된 캠프 상태
 * @param invitationId - 초대 ID (링크 생성용, 선택사항)
 * @param planGroupId - 플랜 그룹 ID (링크 생성용, 선택사항)
 * @returns 상태 정보 객체
 */
export function getCampStatusInfo(
  status: CampStatus,
  invitationId?: string,
  planGroupId?: string | null
): CampStatusInfo {
  switch (status) {
    case "PENDING_FORM":
      // planGroupId가 없으면 "작성 중"이 아니라 "참여하기" 상태
      // UI에서 planGroupId가 null이면 "참여하기" 버튼을 표시하도록 처리
      if (!planGroupId) {
        return {
          status: "PENDING_FORM",
          label: "", // 배지를 표시하지 않음 (CampInvitationActions에서 "참여하기" 버튼 표시)
          color: "yellow",
          description: "참여 정보를 작성해주세요.",
          canEdit: true,
          canStart: false,
          nextStep: "참여 정보 제출",
          badgeClassName: "", // 빈 문자열로 배지를 표시하지 않음
          linkHref: undefined,
          linkLabel: undefined,
        };
      }
      return {
        status: "PENDING_FORM",
        label: "작성 중",
        color: "yellow",
        description: "참여 정보를 작성해주세요.",
        canEdit: true,
        canStart: false,
        nextStep: "참여 정보 제출",
        badgeClassName: "inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800",
        linkHref: invitationId ? `/camp/${invitationId}` : undefined,
        linkLabel: "이어서 작성하기 →",
      };

    case "WAITING_REVIEW":
      return {
        status: "WAITING_REVIEW",
        label: "관리자 검토 중",
        color: "blue",
        description: "플랜 생성 대기 중입니다.",
        canEdit: false,
        canStart: false,
        nextStep: "플랜 생성",
        badgeClassName: "inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800",
      };

    case "READY_TO_START":
      return {
        status: "READY_TO_START",
        label: "플랜 생성 완료",
        color: "blue",
        description: "활성화 대기 중입니다.",
        canEdit: false,
        canStart: false,
        nextStep: "학습 시작",
        badgeClassName: "inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800",
      };

    case "IN_PROGRESS":
      return {
        status: "IN_PROGRESS",
        label: "학습 시작 가능",
        color: "green",
        description: "학습을 시작할 수 있습니다.",
        canEdit: false,
        canStart: true,
        nextStep: "학습 진행",
        badgeClassName: "inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800",
        linkHref: planGroupId ? `/plan/group/${planGroupId}?camp=true` : undefined,
      };

    case "PAUSED":
      return {
        status: "PAUSED",
        label: "일시정지됨",
        color: "orange",
        description: "학습이 일시정지되었습니다.",
        canEdit: false,
        canStart: false,
        nextStep: "재개",
        badgeClassName: "inline-flex items-center rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800",
      };

    case "COMPLETED":
      return {
        status: "COMPLETED",
        label: "완료됨",
        color: "gray",
        description: "학습이 완료되었습니다.",
        canEdit: false,
        canStart: false,
        nextStep: undefined,
        badgeClassName: "inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800",
      };

    default:
      // 타입 안전성을 위한 기본값
      return {
        status: "WAITING_REVIEW",
        label: "상태 확인 중",
        color: "gray",
        description: "상태를 확인할 수 없습니다.",
        canEdit: false,
        canStart: false,
        badgeClassName: "inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800",
      };
  }
}

/**
 * 캠프 초대 정보로부터 통합 상태 정보 반환 (편의 함수)
 * 
 * @param invitation - 캠프 초대 정보
 * @returns 통합 상태 정보
 */
export function getCampStatusFromInvitation(invitation: {
  status: CampInvitationStatus;
  planGroupStatus: PlanStatus | null;
  hasPlans: boolean;
  isDraft?: boolean;
  id: string;
  planGroupId?: string | null;
}): CampStatusInfo {
  const planGroupId = invitation.planGroupId ?? null;
  
  const campStatus = getCampStatus(
    invitation.status,
    invitation.planGroupStatus,
    invitation.hasPlans,
    invitation.isDraft ?? false,
    planGroupId
  );

  // planGroupId가 없고 pending 상태이면 "작성 중"이 아니라 "참여하기" 상태로 처리
  // UI에서 planGroupId가 null이면 "참여하기" 버튼을 표시하도록 처리
  // 여기서는 상태 정보를 조정하여 "이어서 작성하기" 링크를 표시하지 않도록 함
  const statusInfo = getCampStatusInfo(
    campStatus,
    invitation.id,
    planGroupId
  );

  // planGroupId가 없고 pending 상태이면 "이어서 작성하기" 링크를 제거
  if (invitation.status === "pending" && !planGroupId && campStatus === "PENDING_FORM") {
    return {
      ...statusInfo,
      linkHref: undefined,
      linkLabel: undefined,
      description: "참여 정보를 작성해주세요.",
    };
  }

  return statusInfo;
}

