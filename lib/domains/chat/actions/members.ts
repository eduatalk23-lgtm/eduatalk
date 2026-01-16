"use server";

/**
 * Chat Member Server Actions
 * 멤버 초대/관리
 */

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import * as chatService from "../service";
import type { ChatUserType, ChatActionResult } from "../types";

/**
 * 현재 사용자의 userType 결정
 */
function getUserType(role: string | null): ChatUserType {
  if (role === "admin" || role === "consultant") return "admin";
  return "student";
}

/**
 * 그룹 채팅방에 멤버 초대
 *
 * @param roomId 채팅방 ID
 * @param memberIds 초대할 사용자 ID 목록
 * @param memberTypes 각 사용자의 유형
 */
export async function inviteMembersAction(
  roomId: string,
  memberIds: string[],
  memberTypes: ChatUserType[]
): Promise<ChatActionResult<void>> {
  try {
    // 입력 검증
    if (memberIds.length !== memberTypes.length) {
      return {
        success: false,
        error: "멤버 ID와 유형의 개수가 일치하지 않습니다",
      };
    }

    if (memberIds.length === 0) {
      return {
        success: false,
        error: "초대할 멤버를 선택해주세요",
      };
    }

    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.inviteMembers(
      roomId,
      userId,
      userType,
      memberIds,
      memberTypes
    );
  } catch (error) {
    console.error("[inviteMembersAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "멤버 초대 실패",
    };
  }
}
