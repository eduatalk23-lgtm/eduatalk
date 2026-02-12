"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { getStudentPhones } from "@/lib/utils/studentPhoneUtils";
import { formatSMSTemplate } from "@/lib/services/smsTemplates";
import { getAlimtalkTemplate } from "@/lib/services/alimtalkTemplates";
import { sendAlimtalk } from "@/lib/services/alimtalkService";
import { sendSMS } from "@/lib/services/smsService";
import type {
  SessionType,
  ConsultationSchedule,
} from "../types";

const ACTION_CTX = { domain: "consulting", action: "schedule" };

/**
 * consultation_schedules 테이블은 마이그레이션 후 생성되므로
 * 생성된 Supabase 타입에 아직 포함되지 않음.
 * 타입 안전성을 위해 헬퍼를 사용하여 접근.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scheduleTable(client: { from: (...args: unknown[]) => unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from("consultation_schedules");
}

// ── 상담 일정 생성 + 알림톡 발송 ──

export async function createConsultationSchedule(input: {
  studentId: string;
  consultantId: string;
  sessionType: SessionType;
  enrollmentId?: string;
  programName?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  visitor?: string;
  location?: string;
  description?: string;
  sendNotification?: boolean;
}): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  try {
    const { userId, role } = await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 테넌트 격리: 학생이 해당 테넌트에 속하는지 확인
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, tenant_id")
      .eq("id", input.studentId)
      .maybeSingle();

    if (studentError || !student) {
      return { success: false, error: "학생을 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && student.tenant_id !== tenantContext.tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    // duration 자동 계산
    const durationMinutes =
      input.durationMinutes ?? calculateDuration(input.startTime, input.endTime);

    // DB INSERT
    const { data: schedule, error: insertError } = await scheduleTable(supabase)
      .insert({
        tenant_id: tenantContext.tenantId,
        student_id: input.studentId,
        consultant_id: input.consultantId,
        session_type: input.sessionType,
        enrollment_id: input.enrollmentId || null,
        scheduled_date: input.scheduledDate,
        start_time: input.startTime,
        end_time: input.endTime,
        duration_minutes: durationMinutes,
        visitor: input.visitor || null,
        location: input.location || null,
        description: input.description || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (insertError || !schedule) {
      logActionError(ACTION_CTX, insertError, {
        context: "일정 생성",
        studentId: input.studentId,
      });
      return { success: false, error: "상담 일정 등록에 실패했습니다." };
    }

    const scheduleId = (schedule as { id: string }).id;

    // 알림 발송
    if (input.sendNotification !== false) {
      await sendScheduleNotification({
        scheduleId,
        tenantId: tenantContext.tenantId,
        studentId: input.studentId,
        studentName: student.name ?? "",
        consultantId: input.consultantId,
        sessionType: input.sessionType,
        programName: input.programName,
        scheduledDate: input.scheduledDate,
        startTime: input.startTime,
        endTime: input.endTime,
        durationMinutes,
        visitor: input.visitor,
        location: input.location,
      });
    }

    revalidatePath(`/admin/students/${input.studentId}`);
    return { success: true, scheduleId };
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "createConsultationSchedule",
      studentId: input.studentId,
    });
    return { success: false, error: "상담 일정 등록 중 오류가 발생했습니다." };
  }
}

// ── 상담 일정 목록 조회 ──

export async function getConsultationSchedules(
  studentId: string
): Promise<ConsultationSchedule[]> {
  try {
    await requireAdminOrConsultant();

    const supabase = await createSupabaseServerClient();

    const { data, error } = await scheduleTable(supabase)
      .select(
        `
        *,
        consultant:admin_users!consultant_id(name),
        enrollment:enrollments!enrollment_id(id, programs(name))
      `
      )
      .eq("student_id", studentId)
      .order("scheduled_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (error) {
      logActionError(ACTION_CTX, error, {
        context: "일정 목록 조회",
        studentId,
      });
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data as any[]) ?? []).map((row) => {
      const consultant = row.consultant as { name: string } | null;
      // enrollment → programs JOIN 결과에서 프로그램명 추출
      const enrollment = row.enrollment as {
        id: string;
        programs: { name: string } | { name: string }[] | null;
      } | null;
      let programName: string | undefined;
      if (enrollment?.programs) {
        const prog = enrollment.programs;
        programName = Array.isArray(prog) ? prog[0]?.name : prog.name;
      }
      return {
        ...row,
        consultant_name: consultant?.name ?? undefined,
        program_name: programName,
        consultant: undefined,
        enrollment: undefined,
      } as ConsultationSchedule;
    });
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "getConsultationSchedules",
      studentId,
    });
    return [];
  }
}

// ── 상담 일정 상태 변경 ──

export async function updateScheduleStatus(
  scheduleId: string,
  status: "completed" | "cancelled" | "no_show",
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrConsultant();

    const supabase = await createSupabaseServerClient();

    const { error } = await scheduleTable(supabase)
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scheduleId);

    if (error) {
      logActionError(ACTION_CTX, error, {
        context: "상태 변경",
        scheduleId,
        status,
      });
      return { success: false, error: "상태 변경에 실패했습니다." };
    }

    revalidatePath(`/admin/students/${studentId}`);
    return { success: true };
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "updateScheduleStatus",
      scheduleId,
    });
    return { success: false, error: "상태 변경 중 오류가 발생했습니다." };
  }
}

// ── 내부: 알림톡/SMS 발송 ──

async function sendScheduleNotification(params: {
  scheduleId: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  consultantId: string;
  sessionType: SessionType;
  programName?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number | null;
  visitor?: string;
  location?: string;
}): Promise<void> {
  try {
    // 학부모 전화번호 조회
    const studentPhones = await getStudentPhones(params.studentId);
    const recipientPhone =
      studentPhones?.mother_phone || studentPhones?.father_phone;

    if (!recipientPhone) {
      logActionDebug(ACTION_CTX, "학부모 전화번호 없음, 알림 건너뜀", {
        studentId: params.studentId,
      });
      return;
    }

    // 테넌트 정보 조회 (address, representative_phone은 마이그레이션 후 추가 컬럼)
    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: false,
    });

    if (!adminClient) return;

    type TenantExtended = {
      name: string | null;
      address?: string | null;
      representative_phone?: string | null;
    };

    const [tenantResult, consultantResult] = await Promise.all([
      adminClient
        .from("tenants")
        .select("*")
        .eq("id", params.tenantId)
        .maybeSingle(),
      adminClient
        .from("admin_users")
        .select("name")
        .eq("id", params.consultantId)
        .maybeSingle(),
    ]);

    const tenant = tenantResult.data as TenantExtended | null;
    const consultant = consultantResult.data;

    // 일정 포맷팅: "2/12(목) 14:00~15:00"
    const scheduleFormatted = formatScheduleDateTime(
      params.scheduledDate,
      params.startTime,
      params.endTime
    );

    // 알림톡 상담유형: 프로그램명 우선, 없으면 세션 유형
    const consultationType = params.programName || params.sessionType;

    const templateVariables: Record<string, string> = {
      학원명: tenant?.name ?? "",
      학생명: params.studentName,
      상담유형: consultationType,
      컨설턴트명: consultant?.name ?? "",
      방문상담자: params.visitor || "학생 & 학부모",
      상담시간: String(params.durationMinutes ?? ""),
      상담일정: scheduleFormatted,
      상담장소: params.location || tenant?.address || "",
      대표번호: tenant?.representative_phone || "",
    };

    const message = formatSMSTemplate("consultation_scheduled", templateVariables);

    // 알림톡 우선, 없으면 SMS
    const alimtalkTemplate = getAlimtalkTemplate("consultation_scheduled");

    let sent = false;

    if (alimtalkTemplate) {
      const result = await sendAlimtalk({
        recipientPhone,
        message,
        tenantId: params.tenantId,
        templateCode: alimtalkTemplate.templateCode,
        recipientId: params.studentId,
      });
      sent = result.success;
    }

    if (!sent && !alimtalkTemplate) {
      const smsResult = await sendSMS({
        recipientPhone,
        message,
        recipientId: params.studentId,
        tenantId: params.tenantId,
      });
      sent = smsResult.success;
    }

    // notification_sent 업데이트
    if (sent) {
      await scheduleTable(adminClient)
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq("id", params.scheduleId);
    }

    logActionDebug(ACTION_CTX, "알림 발송 결과", {
      scheduleId: params.scheduleId,
      sent,
      recipientPhone,
    });
  } catch (error) {
    // 알림 발송 실패는 일정 생성 자체를 실패시키지 않음
    logActionError(ACTION_CTX, error, {
      context: "sendScheduleNotification",
      scheduleId: params.scheduleId,
    });
  }
}

// ── 유틸 ──

function calculateDuration(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatScheduleDateTime(
  date: string,
  startTime: string,
  endTime: string
): string {
  const d = new Date(date + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = weekdays[d.getDay()];
  const start = startTime.slice(0, 5); // "14:00"
  const end = endTime.slice(0, 5);
  return `${month}/${day}(${weekday}) ${start}~${end}`;
}
