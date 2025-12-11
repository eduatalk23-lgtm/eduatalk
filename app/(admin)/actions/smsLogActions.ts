"use server";

import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import {
  AppError,
  ErrorCode,
  normalizeError,
  getUserFacingMessage,
  logError,
} from "@/lib/errors";

export type SMSLogFilter = {
  startDate?: string;
  endDate?: string;
  studentId?: string;
  status?: "pending" | "sent" | "delivered" | "failed";
  smsType?: "attendance_check_in" | "attendance_check_out" | "attendance_absent" | "attendance_late";
};

export type SMSLog = {
  id: string;
  tenant_id: string;
  recipient_id: string | null;
  recipient_phone: string;
  message_content: string;
  template_id: string | null;
  status: "pending" | "sent" | "delivered" | "failed";
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  created_at: string;
  student_name?: string | null;
};

/**
 * 출석 관련 SMS 로그 조회
 */
export async function getAttendanceSMSLogs(
  filters: SMSLogFilter = {},
  page: number = 1,
  pageSize: number = 50
): Promise<{
  success: boolean;
  data?: SMSLog[];
  total?: number;
  error?: string;
}> {
  try {
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      throw new AppError(
        "테넌트 정보를 찾을 수 없습니다.",
        ErrorCode.NOT_FOUND,
        404,
        true
      );
    }

    const supabase = await createSupabaseServerClient();

    // 출석 관련 SMS 메시지 키워드로 필터링
    const attendanceKeywords = ["입실", "퇴실", "결석", "지각", "출석"];
    
    let query = supabase
      .from("sms_logs")
      .select(
        "id, tenant_id, recipient_id, recipient_phone, message_content, template_id, status, sent_at, delivered_at, error_message, created_at",
        { count: "exact" }
      )
      .eq("tenant_id", tenantContext.tenantId)
      .or(
        attendanceKeywords.map((keyword) => `message_content.ilike.%${keyword}%`).join(",")
      )
      .order("created_at", { ascending: false });

    // 필터 적용
    if (filters.startDate) {
      query = query.gte("created_at", filters.startDate);
    }

    if (filters.endDate) {
      // endDate는 하루의 끝까지 포함
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      query = query.lte("created_at", endDate.toISOString());
    }

    if (filters.studentId) {
      query = query.eq("recipient_id", filters.studentId);
    }

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    // 페이지네이션
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error("[smsLogs] SMS 로그 조회 실패:", error);
      throw new AppError(
        error.message || "SMS 로그 조회에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }

    // 학생 이름 조회 (recipient_id가 있는 경우)
    const studentIds = logs
      ?.filter((log) => log.recipient_id)
      .map((log) => log.recipient_id)
      .filter((id): id is string => id !== null) || [];

    let studentNames: Record<string, string | null> = {};
    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from("students")
        .select("id, name")
        .in("id", studentIds);

      if (students) {
        studentNames = students.reduce(
          (acc, student) => {
            acc[student.id] = student.name;
            return acc;
          },
          {} as Record<string, string | null>
        );
      }
    }

    // 학생 이름 추가
    const logsWithStudentNames: SMSLog[] =
      logs?.map((log) => ({
        ...log,
        student_name: log.recipient_id ? studentNames[log.recipient_id] || null : null,
      })) || [];

    // SMS 타입 필터링 (메시지 내용 기반)
    let filteredLogs = logsWithStudentNames;
    if (filters.smsType) {
      const typeKeywords: Record<string, string[]> = {
        attendance_check_in: ["입실"],
        attendance_check_out: ["퇴실"],
        attendance_absent: ["결석"],
        attendance_late: ["지각"],
      };

      const keywords = typeKeywords[filters.smsType] || [];
      if (keywords.length > 0) {
        filteredLogs = logsWithStudentNames.filter((log) =>
          keywords.some((keyword) => log.message_content.includes(keyword))
        );
      }
    }

    return {
      success: true,
      data: filteredLogs,
      total: count || 0,
    };
  } catch (error) {
    // Next.js의 redirect()와 notFound()는 재throw
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string"
    ) {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND")
      ) {
        throw error;
      }
    }

    const normalizedError = normalizeError(error);
    logError(normalizedError, { function: "getAttendanceSMSLogs", filters });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}

/**
 * 전화번호 마스킹 처리
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) {
    return phone;
  }

  // 하이픈 제거
  const cleaned = phone.replace(/-/g, "");
  
  if (cleaned.length <= 4) {
    return "****";
  }

  // 앞 3자리와 뒤 4자리만 표시, 중간은 마스킹
  const start = cleaned.slice(0, 3);
  const end = cleaned.slice(-4);
  const masked = cleaned.slice(3, -4).replace(/\d/g, "*");

  return `${start}-${masked}-${end}`;
}

