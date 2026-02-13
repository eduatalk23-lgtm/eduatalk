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
import type { SMSTemplateType } from "@/lib/services/smsTemplates";
import type {
  ConsultationMode,
  ConsultationSchedule,
  NotificationTarget,
  NotificationChannel,
} from "../types";
import { enqueueGoogleCalendarSync } from "@/lib/domains/googleCalendar";

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
  sessionType: string;
  enrollmentId?: string;
  programName: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  consultationMode?: ConsultationMode;
  meetingLink?: string;
  visitor?: string;
  location?: string;
  description?: string;
  sendNotification?: boolean;
  notificationTargets?: NotificationTarget[];
  notificationChannel?: NotificationChannel;
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

    // 과거 날짜 예약 방지
    const todayKST = getTodayKST();
    if (input.scheduledDate < todayKST) {
      return { success: false, error: "과거 날짜에는 상담 일정을 생성할 수 없습니다." };
    }

    // duration 자동 계산 + 유효성 검증
    const durationMinutes =
      input.durationMinutes ?? calculateDuration(input.startTime, input.endTime);

    if (durationMinutes <= 0) {
      return { success: false, error: "종료 시간은 시작 시간 이후여야 합니다." };
    }

    // 컨설턴트 일정 충돌 감지
    const { data: conflicts } = await scheduleTable(supabase)
      .select("id")
      .eq("consultant_id", input.consultantId)
      .eq("scheduled_date", input.scheduledDate)
      .neq("status", "cancelled")
      .lt("start_time", input.endTime)
      .gt("end_time", input.startTime);

    if (conflicts && conflicts.length > 0) {
      return {
        success: false,
        error: "해당 시간에 이미 예약된 상담이 있습니다.",
      };
    }

    // DB INSERT
    const { data: schedule, error: insertError } = await scheduleTable(supabase)
      .insert({
        tenant_id: tenantContext.tenantId,
        student_id: input.studentId,
        consultant_id: input.consultantId,
        session_type: input.sessionType,
        enrollment_id: input.enrollmentId || null,
        program_name: input.programName || null,
        scheduled_date: input.scheduledDate,
        start_time: input.startTime,
        end_time: input.endTime,
        duration_minutes: durationMinutes,
        consultation_mode: input.consultationMode || "대면",
        meeting_link: input.meetingLink || null,
        visitor: input.visitor || null,
        location: input.location || null,
        description: input.description || null,
        notification_targets: input.notificationTargets ?? ["mother"],
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
        consultationMode: input.consultationMode,
        meetingLink: input.meetingLink,
        visitor: input.visitor,
        location: input.location,
        notificationTargets: input.notificationTargets,
        notificationChannel: input.notificationChannel,
      });
    }

    // Google Calendar 동기화 (fire-and-forget)
    await enqueueGoogleCalendarSync({
      scheduleId,
      tenantId: tenantContext.tenantId,
      consultantId: input.consultantId,
      action: "create",
    });

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
      // program_name DB 컬럼이 null이면 enrollment JOIN에서 fallback
      let programName = row.program_name as string | null;
      if (!programName && row.enrollment) {
        const enr = row.enrollment as { id: string; programs: { name: string } | { name: string }[] | null };
        if (enr.programs) {
          programName = Array.isArray(enr.programs)
            ? enr.programs[0]?.name ?? null
            : enr.programs.name ?? null;
        }
      }
      return {
        ...row,
        program_name: programName,
        consultant_name: consultant?.name ?? undefined,
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

// ── 상담 일정 수정 + 변경 알림 ──

export async function updateConsultationSchedule(input: {
  scheduleId: string;
  studentId: string;
  consultantId: string;
  sessionType: string;
  enrollmentId?: string;
  programName: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  consultationMode?: ConsultationMode;
  meetingLink?: string;
  visitor?: string;
  location?: string;
  description?: string;
  sendNotification?: boolean;
  notificationTargets?: NotificationTarget[];
  notificationChannel?: NotificationChannel;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 기존 일정 조회 (변경 감지용)
    const { data: existing } = await scheduleTable(supabase)
      .select("scheduled_date, start_time, end_time, location, session_type, consultation_mode, meeting_link")
      .eq("id", input.scheduleId)
      .single();

    const durationMinutes = calculateDuration(input.startTime, input.endTime);

    if (durationMinutes <= 0) {
      return { success: false, error: "종료 시간은 시작 시간 이후여야 합니다." };
    }

    // 컨설턴트 일정 충돌 감지 (자기 자신 제외)
    const { data: conflicts } = await scheduleTable(supabase)
      .select("id")
      .eq("consultant_id", input.consultantId)
      .eq("scheduled_date", input.scheduledDate)
      .neq("status", "cancelled")
      .neq("id", input.scheduleId)
      .lt("start_time", input.endTime)
      .gt("end_time", input.startTime);

    if (conflicts && conflicts.length > 0) {
      return {
        success: false,
        error: "해당 시간에 이미 예약된 상담이 있습니다.",
      };
    }

    const { error: updateError } = await scheduleTable(supabase)
      .update({
        consultant_id: input.consultantId,
        session_type: input.sessionType,
        enrollment_id: input.enrollmentId || null,
        program_name: input.programName || null,
        scheduled_date: input.scheduledDate,
        start_time: input.startTime,
        end_time: input.endTime,
        duration_minutes: durationMinutes,
        consultation_mode: input.consultationMode || "대면",
        meeting_link: input.meetingLink || null,
        visitor: input.visitor || null,
        location: input.location || null,
        description: input.description || null,
        notification_targets: input.notificationTargets ?? ["mother"],
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.scheduleId);

    if (updateError) {
      logActionError(ACTION_CTX, updateError, {
        context: "일정 수정",
        scheduleId: input.scheduleId,
      });
      return { success: false, error: "상담 일정 수정에 실패했습니다." };
    }

    // 날짜/시간/장소가 변경된 경우에만 변경 알림 발송
    if (input.sendNotification !== false && existing) {
      const old = existing as {
        scheduled_date: string;
        start_time: string;
        end_time: string;
        location: string | null;
        consultation_mode: string | null;
        meeting_link: string | null;
        session_type: string;
      };
      const changed =
        old.scheduled_date !== input.scheduledDate ||
        old.start_time !== input.startTime ||
        old.end_time !== input.endTime ||
        (old.location ?? "") !== (input.location ?? "") ||
        (old.consultation_mode ?? "대면") !== (input.consultationMode ?? "대면") ||
        (old.meeting_link ?? "") !== (input.meetingLink ?? "");

      if (changed) {
        const mode = input.consultationMode ?? "대면";
        const changedTemplateType: SMSTemplateType =
          mode === "원격" ? "consultation_changed_remote" : "consultation_changed";

        await sendChangeNotification({
          templateType: changedTemplateType,
          scheduleId: input.scheduleId,
          tenantId: tenantContext.tenantId,
          studentId: input.studentId,
          consultantId: input.consultantId,
          sessionType: input.sessionType,
          programName: input.programName,
          scheduledDate: input.scheduledDate,
          startTime: input.startTime,
          endTime: input.endTime,
          consultationMode: input.consultationMode,
          meetingLink: input.meetingLink,
          visitor: input.visitor,
          location: input.location,
          notificationTargets: input.notificationTargets,
          notificationChannel: input.notificationChannel,
        });
      }
    }

    // Google Calendar 동기화 (fire-and-forget)
    await enqueueGoogleCalendarSync({
      scheduleId: input.scheduleId,
      tenantId: tenantContext.tenantId,
      consultantId: input.consultantId,
      action: "update",
    });

    revalidatePath(`/admin/students/${input.studentId}`);
    return { success: true };
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "updateConsultationSchedule",
      scheduleId: input.scheduleId,
    });
    return { success: false, error: "상담 일정 수정 중 오류가 발생했습니다." };
  }
}

// ── 상담 일정 삭제 (알림 없이 단순 삭제) ──

export async function deleteConsultationSchedule(input: {
  scheduleId: string;
  studentId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();

    // 삭제 전 일정 정보 조회 (Google Calendar 취소용)
    const { data: existing } = await scheduleTable(supabase)
      .select("consultant_id, google_calendar_event_id")
      .eq("id", input.scheduleId)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: "일정을 찾을 수 없습니다." };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = existing as any;

    // Google Calendar 이벤트 취소 (삭제 전에 수행 - FK 제약 때문)
    if (row.google_calendar_event_id) {
      await enqueueGoogleCalendarSync({
        scheduleId: input.scheduleId,
        tenantId: tenantContext.tenantId,
        consultantId: row.consultant_id,
        action: "cancel",
      });
    }

    const { error: deleteError } = await scheduleTable(supabase)
      .delete()
      .eq("id", input.scheduleId);

    if (deleteError) {
      logActionError(ACTION_CTX, deleteError, {
        context: "일정 삭제",
        scheduleId: input.scheduleId,
      });
      return { success: false, error: "상담 일정 삭제에 실패했습니다." };
    }

    revalidatePath(`/admin/students/${input.studentId}`);
    return { success: true };
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "deleteConsultationSchedule",
      scheduleId: input.scheduleId,
    });
    return { success: false, error: "상담 일정 삭제 중 오류가 발생했습니다." };
  }
}

// ── 상담 일정 상태 변경 ──

export async function updateScheduleStatus(
  scheduleId: string,
  status: "completed" | "cancelled" | "no_show",
  studentId: string,
  sendNotification?: boolean,
  notificationChannel?: NotificationChannel
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    const supabase = await createSupabaseServerClient();

    // 취소 시 알림 발송 + Google Calendar 동기화를 위해 일정 정보 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existing: any = null;
    if (status === "cancelled" && tenantContext?.tenantId) {
      const { data } = await scheduleTable(supabase)
        .select("consultant_id, session_type, program_name, scheduled_date, start_time, end_time, notification_targets, status")
        .eq("id", scheduleId)
        .maybeSingle();
      existing = data;
    }

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

    // 취소 시 알림 발송
    if (status === "cancelled" && sendNotification && tenantContext?.tenantId && existing) {
      try {
        await sendChangeNotification({
          templateType: "consultation_cancelled",
          scheduleId,
          tenantId: tenantContext.tenantId,
          studentId,
          consultantId: existing.consultant_id,
          sessionType: existing.session_type,
          programName: existing.program_name,
          scheduledDate: existing.scheduled_date,
          startTime: existing.start_time,
          endTime: existing.end_time,
          notificationTargets: existing.notification_targets as NotificationTarget[] | undefined,
          notificationChannel,
        });
      } catch (notifyError) {
        logActionError(ACTION_CTX, notifyError, {
          context: "취소 알림 발송 실패 (상태 변경은 완료됨)",
          scheduleId,
        });
      }
    }

    // 취소 시 Google Calendar 이벤트도 취소 (fire-and-forget)
    const consultantId = existing?.consultant_id ?? null;
    if (status === "cancelled" && tenantContext?.tenantId && consultantId) {
      await enqueueGoogleCalendarSync({
        scheduleId,
        tenantId: tenantContext.tenantId,
        consultantId,
        action: "cancel",
      });
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

// ── 내부: 알림 대상 전화번호 해석 ──

const TARGET_LABELS: Record<NotificationTarget, string> = {
  student: "학생",
  mother: "모",
  father: "부",
};

function resolveTargetPhones(
  phones: { phone: string | null; mother_phone: string | null; father_phone: string | null },
  targets: NotificationTarget[]
): { phone: string; targetLabel: string }[] {
  const result: { phone: string; targetLabel: string }[] = [];
  const seen = new Set<string>();
  for (const target of targets) {
    const phone =
      target === "student" ? phones.phone :
      target === "mother" ? phones.mother_phone :
      target === "father" ? phones.father_phone : null;
    if (phone && !seen.has(phone)) {
      seen.add(phone);
      result.push({ phone, targetLabel: TARGET_LABELS[target] });
    }
  }
  return result;
}

// ── 내부: 알림톡/SMS 발송 ──

async function sendScheduleNotification(params: {
  scheduleId: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  consultantId: string;
  sessionType: string;
  programName?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number | null;
  consultationMode?: ConsultationMode;
  meetingLink?: string;
  visitor?: string;
  location?: string;
  notificationTargets?: NotificationTarget[];
  notificationChannel?: NotificationChannel;
}): Promise<void> {
  try {
    // 학생/학부모 전화번호 조회
    const studentPhones = await getStudentPhones(params.studentId);
    if (!studentPhones) {
      logActionDebug(ACTION_CTX, "전화번호 정보 없음, 알림 건너뜀", {
        studentId: params.studentId,
      });
      return;
    }

    const targets = params.notificationTargets ?? ["mother"];
    const recipients = resolveTargetPhones(studentPhones, targets);

    if (recipients.length === 0) {
      logActionDebug(ACTION_CTX, "알림 대상 전화번호 없음, 알림 건너뜀", {
        studentId: params.studentId,
        targets,
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

    // 일정 포맷팅: "2/12(목) 14:00~15:00 (60분)"
    const scheduleFormatted = formatScheduleDateTime(
      params.scheduledDate,
      params.startTime,
      params.endTime,
      params.durationMinutes
    );

    // 알림톡 상담유형: 프로그램명 우선, 없으면 세션 유형
    const consultationType = params.programName || params.sessionType;

    const isRemote = params.consultationMode === "원격";
    const smsTemplateType: SMSTemplateType = isRemote
      ? "consultation_scheduled_remote"
      : "consultation_scheduled";

    const templateVariables: Record<string, string> = {
      학원명: tenant?.name ?? "",
      학생명: params.studentName,
      상담유형: consultationType,
      컨설턴트명: consultant?.name ?? "",
      방문상담자: params.visitor || "학생 & 학부모",
      상담일정: scheduleFormatted,
      ...(isRemote
        ? { 참가링크: params.meetingLink || "" }
        : { 상담장소: params.location || tenant?.address || "" }),
      대표번호: tenant?.representative_phone || "",
    };

    const message = formatSMSTemplate(smsTemplateType, templateVariables);

    const channel = params.notificationChannel ?? "alimtalk";
    const alimtalkTemplate = channel === "alimtalk" ? getAlimtalkTemplate(smsTemplateType) : null;

    let anySent = false;

    // 각 대상에게 개별 발송
    for (const { phone: recipientPhone, targetLabel } of recipients) {
      let sent = false;

      if (alimtalkTemplate) {
        const result = await sendAlimtalk({
          recipientPhone,
          message,
          smsFallbackMessage: message,
          smsFallbackSubject: "상담 일정 안내",
          tenantId: params.tenantId,
          templateCode: alimtalkTemplate.templateCode,
          recipientId: params.studentId,
          consultationScheduleId: params.scheduleId,
          templateVariables,
          variableOrder: alimtalkTemplate.variableOrder,
          notificationTarget: targetLabel,
        });
        sent = result.success;
      }

      // 알림톡 미사용 또는 실패 시 SMS fallback (SMS 채널 선택 시 항상 여기로)
      if (!sent) {
        const smsResult = await sendSMS({
          recipientPhone,
          message,
          subject: "상담 일정 안내",
          recipientId: params.studentId,
          tenantId: params.tenantId,
          consultationScheduleId: params.scheduleId,
          notificationTarget: targetLabel,
        });
        sent = smsResult.success;
      }

      if (sent) anySent = true;

      logActionDebug(ACTION_CTX, "알림 발송 결과", {
        scheduleId: params.scheduleId,
        sent,
        channel,
        recipientPhone,
        targetLabel,
      });
    }

    // notification_sent 업데이트
    if (anySent) {
      await scheduleTable(adminClient)
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq("id", params.scheduleId);
    }
  } catch (error) {
    // 알림 발송 실패는 일정 생성 자체를 실패시키지 않음
    logActionError(ACTION_CTX, error, {
      context: "sendScheduleNotification",
      scheduleId: params.scheduleId,
    });
  }
}

// ── 내부: 변경/취소 알림 발송 ──

async function sendChangeNotification(params: {
  templateType: SMSTemplateType;
  scheduleId: string;
  tenantId: string;
  studentId: string;
  consultantId: string;
  sessionType: string;
  programName?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  consultationMode?: ConsultationMode;
  meetingLink?: string;
  visitor?: string;
  location?: string;
  notificationTargets?: NotificationTarget[];
  notificationChannel?: NotificationChannel;
}): Promise<void> {
  try {
    const studentPhones = await getStudentPhones(params.studentId);
    if (!studentPhones) return;

    const targets = params.notificationTargets ?? ["mother"];
    const recipients = resolveTargetPhones(studentPhones, targets);

    if (recipients.length === 0) return;

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

    const [tenantResult, consultantResult, studentResult] = await Promise.all([
      adminClient.from("tenants").select("*").eq("id", params.tenantId).maybeSingle(),
      adminClient.from("admin_users").select("name").eq("id", params.consultantId).maybeSingle(),
      adminClient.from("students").select("name").eq("id", params.studentId).maybeSingle(),
    ]);

    const tenant = tenantResult.data as TenantExtended | null;
    const consultationType = params.programName || params.sessionType;
    const scheduleFormatted = formatScheduleDateTime(
      params.scheduledDate,
      params.startTime,
      params.endTime
    );

    const isRemote = params.consultationMode === "원격";

    const templateVariables: Record<string, string> = {
      학원명: tenant?.name ?? "",
      학생명: studentResult.data?.name ?? "",
      상담유형: consultationType,
      컨설턴트명: consultantResult.data?.name ?? "",
      방문상담자: params.visitor || "학생 & 학부모",
      상담일정: scheduleFormatted,
      ...(isRemote
        ? { 참가링크: params.meetingLink || "" }
        : { 상담장소: params.location || tenant?.address || "" }),
      대표번호: tenant?.representative_phone || "",
    };

    const message = formatSMSTemplate(params.templateType, templateVariables);
    const channel = params.notificationChannel ?? "alimtalk";
    const alimtalkTemplate = channel === "alimtalk" ? getAlimtalkTemplate(params.templateType) : null;

    // LMS 대체 발송 제목 (변경/취소에 따라 다름)
    const lmsSubject = params.templateType.includes("cancelled") ? "상담 취소 안내" : "상담 변경 안내";

    // 각 대상에게 개별 발송
    for (const { phone: recipientPhone, targetLabel } of recipients) {
      let sent = false;

      if (alimtalkTemplate) {
        const result = await sendAlimtalk({
          recipientPhone,
          message,
          smsFallbackMessage: message,
          smsFallbackSubject: lmsSubject,
          tenantId: params.tenantId,
          templateCode: alimtalkTemplate.templateCode,
          recipientId: params.studentId,
          consultationScheduleId: params.scheduleId,
          templateVariables,
          variableOrder: alimtalkTemplate.variableOrder,
          notificationTarget: targetLabel,
        });
        sent = result.success;
      }

      // 알림톡 미사용 또는 실패 시 SMS fallback (SMS 채널 선택 시 항상 여기로)
      if (!sent) {
        const smsResult = await sendSMS({
          recipientPhone,
          message,
          subject: lmsSubject,
          recipientId: params.studentId,
          tenantId: params.tenantId,
          consultationScheduleId: params.scheduleId,
          notificationTarget: targetLabel,
        });
        sent = smsResult.success;
      }

      logActionDebug(ACTION_CTX, `${params.templateType} 알림 발송`, {
        scheduleId: params.scheduleId,
        sent,
        channel,
        recipientPhone,
        targetLabel,
      });
    }
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "sendChangeNotification",
      scheduleId: params.scheduleId,
    });
  }
}

// ── 유틸 ──

function getTodayKST(): string {
  const kstNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const y = kstNow.getFullYear();
  const m = String(kstNow.getMonth() + 1).padStart(2, "0");
  const d = String(kstNow.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function calculateDuration(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function formatScheduleDateTime(
  date: string,
  startTime: string,
  endTime: string,
  durationMinutes?: number | null
): string {
  const d = new Date(date + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = weekdays[d.getDay()];
  const start = startTime.slice(0, 5); // "14:00"
  const end = endTime.slice(0, 5);
  const base = `${month}/${day}(${weekday}) ${start}~${end}`;
  return durationMinutes ? `${base} (${durationMinutes}분)` : base;
}
