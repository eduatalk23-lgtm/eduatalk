/**
 * 캠프 관련 알림 발송 통합 서비스
 */

import { sendEmail } from "./emailService";
import { CampInvitationEmail } from "@/lib/emails/campInvitationEmail";
import { getCampInvitation, getCampTemplate } from "@/lib/data/campTemplates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { sendInAppNotification } from "./inAppNotificationService";

/**
 * 캠프 초대 알림 발송
 */
export async function sendCampInvitationNotification(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 초대 정보 조회
    const invitation = await getCampInvitation(invitationId);
    if (!invitation) {
      return {
        success: false,
        error: "초대를 찾을 수 없습니다.",
      };
    }

    // 템플릿 정보 조회
    const template = await getCampTemplate(invitation.camp_template_id);
    if (!template) {
      return {
        success: false,
        error: "템플릿을 찾을 수 없습니다.",
      };
    }

    // 학생 정보 조회
    const supabase = await createSupabaseServerClient();
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("name")
      .eq("id", invitation.student_id)
      .maybeSingle();

    if (studentError || !student) {
      console.error(
        "[campNotificationService] 학생 정보 조회 실패:",
        studentError
      );
      return {
        success: false,
        error: "학생 정보를 찾을 수 없습니다.",
      };
    }

    // Supabase Auth에서 사용자 이메일 조회
    const { createSupabaseAdminClient } = await import(
      "@/lib/supabase/admin"
    );
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return {
        success: false,
        error: "관리자 클라이언트를 초기화할 수 없습니다.",
      };
    }

    const { data: authUser, error: authError } =
      await adminClient.auth.admin.getUserById(invitation.student_id);

    if (authError || !authUser?.user?.email) {
      console.error(
        "[campNotificationService] 사용자 이메일 조회 실패:",
        authError
      );
      return {
        success: false,
        error: "학생의 이메일 주소를 찾을 수 없습니다.",
      };
    }

    const studentEmail = authUser.user.email;

    // 초대 URL 생성
    const baseUrl = env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const invitationUrl = `${baseUrl}/camp/${invitationId}`;

    // 날짜 포맷팅
    const formatDate = (dateString: string | null | undefined) => {
      if (!dateString) return undefined;
      try {
        return new Date(dateString).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch {
        return dateString;
      }
    };

    // 이메일 발송
    const result = await sendEmail({
      to: studentEmail,
      subject: `[${template.name}] 캠프 초대 안내`,
      react: CampInvitationEmail({
        studentName: student.name || "학생",
        campName: template.name,
        invitationUrl,
        campStartDate: formatDate(template.camp_start_date),
        campEndDate: formatDate(template.camp_end_date),
        campLocation: template.camp_location || undefined,
      }),
    });

    if (!result.success) {
      console.error(
        "[campNotificationService] 이메일 발송 실패:",
        result.error
      );
    }

    // 인앱 알림 발송 (비동기, 실패해도 이메일 발송은 성공으로 처리)
    sendInAppNotification(
      invitation.student_id,
      "camp_invitation",
      `[${template.name}] 캠프 초대`,
      `${template.name} 캠프에 초대되었습니다. 참여 정보를 제출해주세요.`,
      {
        invitationId: invitation.id,
        templateId: template.id,
        invitationUrl,
      }
    ).catch((err) => {
      console.error(
        "[campNotificationService] 인앱 알림 발송 실패:",
        err
      );
    });

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      "[campNotificationService] 알림 발송 중 예외 발생:",
      errorMessage
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 캠프 리마인더 알림 발송
 */
export async function sendCampReminderNotification(
  invitationId: string
): Promise<{ success: boolean; error?: string }> {
  // 리마인더는 초대 알림과 동일한 템플릿 사용 (제목만 변경)
  // 향후 별도 템플릿으로 확장 가능
  try {
    const invitation = await getCampInvitation(invitationId);
    if (!invitation) {
      return {
        success: false,
        error: "초대를 찾을 수 없습니다.",
      };
    }

    const template = await getCampTemplate(invitation.camp_template_id);
    if (!template) {
      return {
        success: false,
        error: "템플릿을 찾을 수 없습니다.",
      };
    }

    const supabase = await createSupabaseServerClient();
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("name")
      .eq("id", invitation.student_id)
      .maybeSingle();

    if (studentError || !student) {
      return {
        success: false,
        error: "학생 정보를 찾을 수 없습니다.",
      };
    }

    // Supabase Auth에서 사용자 이메일 조회
    const { createSupabaseAdminClient } = await import(
      "@/lib/supabase/admin"
    );
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return {
        success: false,
        error: "관리자 클라이언트를 초기화할 수 없습니다.",
      };
    }

    const { data: authUser, error: authError } =
      await adminClient.auth.admin.getUserById(invitation.student_id);

    if (authError || !authUser?.user?.email) {
      return {
        success: false,
        error: "학생의 이메일 주소를 찾을 수 없습니다.",
      };
    }

    const studentEmail = authUser.user.email;

    const baseUrl = env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const invitationUrl = `${baseUrl}/camp/${invitationId}`;

    const formatDate = (dateString: string | null | undefined) => {
      if (!dateString) return undefined;
      try {
        return new Date(dateString).toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch {
        return dateString;
      }
    };

    const result = await sendEmail({
      to: studentEmail,
      subject: `[${template.name}] 캠프 참여 리마인더`,
      react: CampInvitationEmail({
        studentName: student.name || "학생",
        campName: template.name,
        invitationUrl,
        campStartDate: formatDate(template.camp_start_date),
        campEndDate: formatDate(template.camp_end_date),
        campLocation: template.camp_location || undefined,
      }),
    });

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      "[campNotificationService] 리마인더 발송 중 예외 발생:",
      errorMessage
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 캠프 상태 변경 알림 발송
 */
export async function sendCampStatusChangeNotification(
  invitationId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  // 상태 변경 알림은 향후 구현
  // 현재는 로깅만 수행
  console.log(
    "[campNotificationService] 상태 변경 알림:",
    invitationId,
    newStatus
  );
  return { success: true };
}

/**
 * 학생 캠프 참여 수락 시 관리자에게 알림 발송
 */
export async function sendCampAcceptanceNotificationToAdmins(params: {
  templateId: string;
  templateName: string;
  studentId: string;
  studentName: string;
  tenantId: string;
  groupId: string;
}): Promise<{ success: boolean; sentCount: number; error?: string }> {
  const { templateId, templateName, studentId, studentName, tenantId, groupId } = params;

  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      console.error("[campNotificationService] Admin 클라이언트 초기화 실패");
      return {
        success: false,
        sentCount: 0,
        error: "서버 설정 오류: Admin 클라이언트를 초기화할 수 없습니다.",
      };
    }

    // 해당 테넌트의 관리자 목록 조회
    const { data: adminUsers, error: adminError } = await adminClient
      .from("admin_users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("role", "admin");

    if (adminError) {
      console.error("[campNotificationService] 관리자 목록 조회 실패:", adminError);
      return {
        success: false,
        sentCount: 0,
        error: adminError.message,
      };
    }

    if (!adminUsers || adminUsers.length === 0) {
      console.warn("[campNotificationService] 해당 테넌트에 관리자가 없습니다:", tenantId);
      return {
        success: true,
        sentCount: 0,
      };
    }

    const adminUserIds = adminUsers.map((u) => u.id);

    // 일괄 알림 발송
    const { sendBulkInAppNotification } = await import("./inAppNotificationService");
    const result = await sendBulkInAppNotification(
      adminUserIds,
      "admin_notification",
      `[${templateName}] 캠프 참여 수락`,
      `${studentName} 학생이 "${templateName}" 캠프에 참여를 수락했습니다.`,
      {
        templateId,
        studentId,
        studentName,
        groupId,
        action: "camp_acceptance",
      },
      tenantId
    );

    if (result.success) {
      console.log("[campNotificationService] 관리자 알림 발송 완료:", {
        templateId,
        templateName,
        studentId,
        studentName,
        adminCount: adminUserIds.length,
        sentCount: result.sentCount,
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[campNotificationService] 관리자 알림 발송 중 예외:", errorMessage);
    return {
      success: false,
      sentCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * 캠프 플랜 생성 완료 시 학생에게 알림 발송
 */
export async function sendPlanCreatedNotificationToStudent(params: {
  studentId: string;
  studentName: string;
  templateId: string;
  templateName: string;
  groupId: string;
  tenantId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { studentId, studentName, templateName, templateId, groupId, tenantId } = params;

  try {
    const result = await sendInAppNotification(
      studentId,
      "plan_created",
      `[${templateName}] 캠프 플랜 생성 완료`,
      `${studentName}님, "${templateName}" 캠프 플랜이 생성되었습니다. 학습 계획을 확인해보세요.`,
      {
        templateId,
        groupId,
        action: "plan_created",
      },
      tenantId
    );

    if (result.success) {
      console.log("[campNotificationService] 학생 플랜 생성 알림 발송 완료:", {
        studentId,
        studentName,
        templateId,
        templateName,
        groupId,
      });
    }

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[campNotificationService] 학생 알림 발송 중 예외:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * A4 개선: 학생의 연결된 학부모 ID 목록 조회
 */
async function getLinkedParentIds(studentId: string): Promise<string[]> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      console.error("[campNotificationService] Admin 클라이언트 초기화 실패");
      return [];
    }

    const { data, error } = await adminClient
      .from("parent_student_links")
      .select("parent_id")
      .eq("student_id", studentId)
      .eq("is_approved", true);

    if (error) {
      console.error("[campNotificationService] 학부모 조회 실패:", error);
      return [];
    }

    return (data ?? []).map((link) => link.parent_id);
  } catch (error) {
    console.error("[campNotificationService] 학부모 조회 중 예외:", error);
    return [];
  }
}

/**
 * A4 개선: 캠프 초대 시 학부모에게 알림 발송
 */
export async function sendCampInvitationNotificationToParents(params: {
  studentId: string;
  studentName: string;
  templateId: string;
  templateName: string;
  tenantId?: string;
}): Promise<{ success: boolean; sentCount: number; error?: string }> {
  const { studentId, studentName, templateId, templateName, tenantId } = params;

  try {
    const parentIds = await getLinkedParentIds(studentId);

    if (parentIds.length === 0) {
      console.log("[campNotificationService] 연결된 학부모 없음:", studentId);
      return { success: true, sentCount: 0 };
    }

    const { sendBulkInAppNotification } = await import("./inAppNotificationService");
    const result = await sendBulkInAppNotification(
      parentIds,
      "camp_invitation",
      `[${templateName}] 캠프 초대 안내`,
      `${studentName} 학생이 "${templateName}" 캠프에 초대되었습니다.`,
      {
        templateId,
        studentId,
        studentName,
        action: "camp_invitation_parent",
      },
      tenantId
    );

    if (result.success) {
      console.log("[campNotificationService] 학부모 캠프 초대 알림 발송 완료:", {
        studentId,
        studentName,
        templateName,
        parentCount: parentIds.length,
        sentCount: result.sentCount,
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[campNotificationService] 학부모 알림 발송 중 예외:", errorMessage);
    return {
      success: false,
      sentCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * A4 개선: 캠프 플랜 생성 완료 시 학부모에게 알림 발송
 */
export async function sendPlanCreatedNotificationToParents(params: {
  studentId: string;
  studentName: string;
  templateId: string;
  templateName: string;
  groupId: string;
  tenantId?: string;
}): Promise<{ success: boolean; sentCount: number; error?: string }> {
  const { studentId, studentName, templateId, templateName, groupId, tenantId } = params;

  try {
    const parentIds = await getLinkedParentIds(studentId);

    if (parentIds.length === 0) {
      console.log("[campNotificationService] 연결된 학부모 없음:", studentId);
      return { success: true, sentCount: 0 };
    }

    const { sendBulkInAppNotification } = await import("./inAppNotificationService");
    const result = await sendBulkInAppNotification(
      parentIds,
      "plan_created",
      `[${templateName}] 캠프 플랜 생성`,
      `${studentName} 학생의 "${templateName}" 캠프 학습 플랜이 생성되었습니다.`,
      {
        templateId,
        studentId,
        studentName,
        groupId,
        action: "plan_created_parent",
      },
      tenantId
    );

    if (result.success) {
      console.log("[campNotificationService] 학부모 플랜 생성 알림 발송 완료:", {
        studentId,
        studentName,
        templateName,
        groupId,
        parentCount: parentIds.length,
        sentCount: result.sentCount,
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[campNotificationService] 학부모 플랜 알림 발송 중 예외:", errorMessage);
    return {
      success: false,
      sentCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * A4 개선: 캠프 학습 진행 마일스톤 달성 시 학부모에게 알림 발송
 */
export async function sendCampProgressNotificationToParents(params: {
  studentId: string;
  studentName: string;
  templateName: string;
  completionRate: number;
  tenantId?: string;
}): Promise<{ success: boolean; sentCount: number; error?: string }> {
  const { studentId, studentName, templateName, completionRate, tenantId } = params;

  try {
    const parentIds = await getLinkedParentIds(studentId);

    if (parentIds.length === 0) {
      return { success: true, sentCount: 0 };
    }

    // 마일스톤 메시지 생성
    let milestoneMessage: string;
    if (completionRate >= 100) {
      milestoneMessage = `${studentName} 학생이 "${templateName}" 캠프 학습을 완료했습니다! 🎉`;
    } else if (completionRate >= 75) {
      milestoneMessage = `${studentName} 학생이 "${templateName}" 캠프 학습의 75%를 완료했습니다.`;
    } else if (completionRate >= 50) {
      milestoneMessage = `${studentName} 학생이 "${templateName}" 캠프 학습의 절반을 완료했습니다.`;
    } else if (completionRate >= 25) {
      milestoneMessage = `${studentName} 학생이 "${templateName}" 캠프 학습을 시작했습니다.`;
    } else {
      return { success: true, sentCount: 0 }; // 25% 미만은 알림 안 함
    }

    const { sendBulkInAppNotification } = await import("./inAppNotificationService");
    const result = await sendBulkInAppNotification(
      parentIds,
      "camp_status_change",
      `[${templateName}] 학습 진행 현황`,
      milestoneMessage,
      {
        studentId,
        studentName,
        templateName,
        completionRate,
        action: "progress_milestone_parent",
      },
      tenantId
    );

    if (result.success) {
      console.log("[campNotificationService] 학부모 진행 알림 발송 완료:", {
        studentId,
        studentName,
        templateName,
        completionRate,
        parentCount: parentIds.length,
        sentCount: result.sentCount,
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[campNotificationService] 학부모 진행 알림 발송 중 예외:", errorMessage);
    return {
      success: false,
      sentCount: 0,
      error: errorMessage,
    };
  }
}

