"use server";

/**
 * Chat Safety Server Actions
 * 차단/신고 기능 (App Store 필수)
 */

import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import * as chatService from "../service";
import * as chatRepository from "../repository";
import {
  getUserType,
  type ChatUserType,
  type ChatActionResult,
  type ChatBlock,
  type ChatReport,
  type ChatReportWithDetails,
  type ReportReason,
  type GetReportsFilter,
} from "../types";

/**
 * 관리자 역할 확인
 */
function isAdminRole(role: string | null): boolean {
  return role === "admin" || role === "consultant";
}

// ============================================
// 차단 기능
// ============================================

/**
 * 사용자 차단
 *
 * @param blockedId 차단할 사용자 ID
 * @param blockedType 차단할 사용자 유형
 */
export async function blockUserAction(
  blockedId: string,
  blockedType: ChatUserType
): Promise<ChatActionResult<void>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    // 자기 자신 차단 방지
    if (blockedId === userId) {
      return {
        success: false,
        error: "자기 자신을 차단할 수 없습니다",
      };
    }

    return await chatService.blockUser(
      userId,
      userType,
      blockedId,
      blockedType
    );
  } catch (error) {
    console.error("[blockUserAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "차단 실패",
    };
  }
}

/**
 * 차단 해제
 *
 * @param blockedId 차단 해제할 사용자 ID
 * @param blockedType 차단 해제할 사용자 유형
 */
export async function unblockUserAction(
  blockedId: string,
  blockedType: ChatUserType
): Promise<ChatActionResult<void>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.unblockUser(
      userId,
      userType,
      blockedId,
      blockedType
    );
  } catch (error) {
    console.error("[unblockUserAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "차단 해제 실패",
    };
  }
}

/**
 * 내 차단 목록 조회
 */
export async function getBlockedUsersAction(): Promise<
  ChatActionResult<ChatBlock[]>
> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    const blocks = await chatRepository.findBlocksByUser(userId, userType);

    return { success: true, data: blocks };
  } catch (error) {
    console.error("[getBlockedUsersAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "차단 목록 조회 실패",
    };
  }
}

// ============================================
// 신고 기능
// ============================================

/**
 * 메시지 신고
 *
 * @param messageId 신고할 메시지 ID
 * @param reason 신고 사유
 * @param description 상세 설명 (선택)
 */
export async function reportMessageAction(
  messageId: string,
  reason: ReportReason,
  description?: string
): Promise<ChatActionResult<void>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    const userType = getUserType(role);

    return await chatService.reportMessage(
      userId,
      userType,
      messageId,
      reason,
      description
    );
  } catch (error) {
    console.error("[reportMessageAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "신고 실패",
    };
  }
}

// ============================================
// 관리자 전용 기능
// ============================================

/**
 * 대기 중인 신고 목록 조회 (관리자 전용)
 */
export async function getPendingReportsAction(): Promise<
  ChatActionResult<ChatReport[]>
> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    // 관리자 권한 확인
    if (!isAdminRole(role)) {
      return {
        success: false,
        error: "관리자 권한이 필요합니다",
      };
    }

    const reports = await chatRepository.findPendingReports();

    return { success: true, data: reports };
  } catch (error) {
    console.error("[getPendingReportsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "신고 목록 조회 실패",
    };
  }
}

/**
 * 신고 처리 (관리자 전용)
 *
 * @param reportId 신고 ID
 * @param status 처리 상태 (resolved, dismissed)
 * @param notes 처리 메모
 */
export async function resolveReportAction(
  reportId: string,
  status: "resolved" | "dismissed",
  notes?: string
): Promise<ChatActionResult<ChatReport>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    // 관리자 권한 확인
    if (!isAdminRole(role)) {
      return {
        success: false,
        error: "관리자 권한이 필요합니다",
      };
    }

    const report = await chatRepository.updateReport(reportId, {
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      resolution_notes: notes ?? null,
    });

    return { success: true, data: report };
  } catch (error) {
    console.error("[resolveReportAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "신고 처리 실패",
    };
  }
}

/**
 * 모든 신고 목록 조회 (관리자 전용, 필터 지원)
 */
export async function getAllReportsAction(
  filters?: GetReportsFilter
): Promise<ChatActionResult<ChatReport[]>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    // 관리자 권한 확인
    if (!isAdminRole(role)) {
      return {
        success: false,
        error: "관리자 권한이 필요합니다",
      };
    }

    const reports = await chatRepository.findAllReports(filters);

    return { success: true, data: reports };
  } catch (error) {
    console.error("[getAllReportsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "신고 목록 조회 실패",
    };
  }
}

/**
 * 신고 상세 조회 (관리자 전용)
 * 신고 정보 + 신고된 메시지 + 신고자/피신고자 정보
 */
export async function getReportDetailsAction(
  reportId: string
): Promise<ChatActionResult<ChatReportWithDetails>> {
  try {
    const { userId, role } = await getCurrentUserRole();

    if (!userId || !role) {
      return { success: false, error: "인증이 필요합니다." };
    }

    // 관리자 권한 확인
    if (!isAdminRole(role)) {
      return {
        success: false,
        error: "관리자 권한이 필요합니다",
      };
    }

    // 신고 기본 정보 조회
    const report = await chatRepository.findReportById(reportId);
    if (!report) {
      return { success: false, error: "신고를 찾을 수 없습니다." };
    }

    // 신고된 메시지 조회
    let reportedMessage = null;
    if (report.reported_message_id) {
      reportedMessage = await chatRepository.findMessageById(
        report.reported_message_id
      );
    }

    // 사용자 정보 배치 조회
    const senderKeys: Array<{ id: string; type: ChatUserType }> = [];

    // 신고자 정보
    senderKeys.push({ id: report.reporter_id, type: report.reporter_type });

    // 피신고자 정보
    if (report.reported_user_id && report.reported_user_type) {
      senderKeys.push({
        id: report.reported_user_id,
        type: report.reported_user_type,
      });
    }

    const senderMap = await chatRepository.findSendersByIds(senderKeys);

    // 신고자 정보 매핑
    const reporterInfo = senderMap.get(
      `${report.reporter_id}_${report.reporter_type}`
    );
    const reporter = reporterInfo
      ? {
          id: reporterInfo.id,
          type: report.reporter_type,
          name: reporterInfo.name,
          profileImageUrl: reporterInfo.profileImageUrl,
        }
      : null;

    // 피신고자 정보 매핑
    let reportedUser = null;
    if (report.reported_user_id && report.reported_user_type) {
      const reportedUserInfo = senderMap.get(
        `${report.reported_user_id}_${report.reported_user_type}`
      );
      if (reportedUserInfo) {
        reportedUser = {
          id: reportedUserInfo.id,
          type: report.reported_user_type,
          name: reportedUserInfo.name,
          profileImageUrl: reportedUserInfo.profileImageUrl,
        };
      }
    }

    const reportWithDetails: ChatReportWithDetails = {
      ...report,
      reportedMessage,
      reporter,
      reportedUser,
    };

    return { success: true, data: reportWithDetails };
  } catch (error) {
    console.error("[getReportDetailsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "신고 상세 조회 실패",
    };
  }
}
