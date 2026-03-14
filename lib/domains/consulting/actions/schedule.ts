"use server";

/**
 * 상담 일정 CRUD — calendar_events + consultation_event_data 기반
 *
 * 이벤트는 테넌트 Primary Calendar에 생성됩니다.
 *
 * @module lib/domains/consulting/actions/schedule
 */

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
import {
  ensureTenantPrimaryCalendar,
  toTimestamptz,
} from "@/lib/domains/calendar/helpers";
import { extractDateYMD, extractTimeHHMM } from "@/lib/domains/calendar/adapters";
import type { SMSTemplateType } from "@/lib/services/smsTemplates";
import type {
  ConsultationMode,
  ConsultationSchedule,
  NotificationTarget,
  NotificationChannel,
} from "../types";

const ACTION_CTX = { domain: "consulting", action: "schedule" };

// ── 상담 일정 생성 (calendar_events + consultation_event_data) ──

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
      .select("id, tenant_id, user_profiles!inner(name)")
      .eq("id", input.studentId)
      .maybeSingle();

    if (studentError || !student) {
      return { success: false, error: "학생을 찾을 수 없습니다." };
    }

    if (role !== "superadmin" && student.tenant_id !== tenantContext.tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const upRaw = student.user_profiles;
    const upObj = Array.isArray(upRaw) ? upRaw[0] : upRaw;
    const studentName = (upObj as { name: string | null } | null)?.name;

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

    // 컨설턴트 일정 충돌 감지 (calendar_events + consultation_event_data)
    const startAt = toTimestamptz(input.scheduledDate, input.startTime);
    const endAt = toTimestamptz(input.scheduledDate, input.endTime);

    const { data: conflicts } = await supabase
      .from("consultation_event_data")
      .select("event_id, calendar_events!inner(id, start_at, end_at, status, deleted_at)")
      .eq("consultant_id", input.consultantId)
      .neq("calendar_events.status", "cancelled")
      .is("calendar_events.deleted_at", null)
      .lt("calendar_events.start_at", endAt)
      .gt("calendar_events.end_at", startAt);

    if (conflicts && conflicts.length > 0) {
      return {
        success: false,
        error: "해당 시간에 이미 예약된 상담이 있습니다.",
      };
    }

    // 테넌트 Primary Calendar 보장
    const calendarId = await ensureTenantPrimaryCalendar(tenantContext.tenantId);

    // 이벤트 제목: "상담유형 - 학생명"
    const title = `${input.sessionType} - ${studentName ?? "학생"}`;

    // 1. calendar_events INSERT
    const { data: event, error: eventError } = await supabase
      .from("calendar_events")
      .insert({
        calendar_id: calendarId,
        tenant_id: tenantContext.tenantId,
        student_id: input.studentId,
        title,
        description: input.description ?? null,
        location: input.location ?? null,
        event_type: "consultation",
        event_subtype: input.sessionType,
        label: input.sessionType,
        is_task: false,
        is_exclusion: false,
        start_at: startAt,
        end_at: endAt,
        timezone: "Asia/Seoul",
        is_all_day: false,
        status: "confirmed",
        transparency: "opaque",
        source: "consultation",
        created_by: userId,
        creator_role: "admin",
      })
      .select("id")
      .single();

    if (eventError || !event) {
      logActionError(ACTION_CTX, eventError, {
        context: "calendar_events 생성",
        studentId: input.studentId,
      });
      return { success: false, error: "상담 일정 등록에 실패했습니다." };
    }

    const eventId = event.id;

    // 2. consultation_event_data INSERT
    const { error: consultDataError } = await supabase
      .from("consultation_event_data")
      .insert({
        event_id: eventId,
        consultant_id: input.consultantId,
        student_id: input.studentId,
        session_type: input.sessionType,
        enrollment_id: input.enrollmentId || null,
        program_name: input.programName || null,
        consultation_mode: input.consultationMode || "대면",
        meeting_link: input.meetingLink || null,
        visitor: input.visitor || null,
        notification_targets: input.notificationTargets ?? ["mother"],
        schedule_status: "scheduled",
      });

    if (consultDataError) {
      logActionError(ACTION_CTX, consultDataError, {
        context: "consultation_event_data 생성",
        eventId,
      });
      // calendar_event는 생성됐으나 확장 데이터 실패 → 정리
      await supabase.from("calendar_events").delete().eq("id", eventId);
      return { success: false, error: "상담 일정 등록에 실패했습니다." };
    }

    // 알림 발송
    if (input.sendNotification !== false) {
      await sendScheduleNotification({
        eventId,
        tenantId: tenantContext.tenantId,
        studentId: input.studentId,
        studentName: studentName ?? "",
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
    import("@/lib/domains/googleCalendar/enqueue").then(({ enqueueGoogleCalendarSync }) =>
      enqueueGoogleCalendarSync({
        eventId,
        tenantId: tenantContext.tenantId!,
        consultantId: input.consultantId,
        action: "create",
      })
    );

    revalidatePath(`/admin/students/${input.studentId}`);
    return { success: true, scheduleId: eventId };
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "createConsultationSchedule",
      studentId: input.studentId,
    });
    return { success: false, error: "상담 일정 등록 중 오류가 발생했습니다." };
  }
}

// ── 상담 일정 목록 조회 (calendar_events + consultation_event_data JOIN) ──

export async function getConsultationSchedules(
  studentId: string
): Promise<ConsultationSchedule[]> {
  try {
    await requireAdminOrConsultant();

    const supabase = await createSupabaseServerClient();

    // calendar_events + consultation_event_data JOIN 조회
    const { data, error } = await supabase
      .from("calendar_events")
      .select(
        `
        id,
        tenant_id,
        student_id,
        start_at,
        end_at,
        description,
        location,
        status,
        created_by,
        created_at,
        updated_at,
        consultation_event_data!inner(
          consultant_id,
          student_id,
          session_type,
          enrollment_id,
          program_name,
          consultation_mode,
          meeting_link,
          visitor,
          schedule_status,
          notification_targets,
          notification_sent,
          notification_sent_at,
          reminder_sent,
          reminder_sent_at,
          google_calendar_event_id,
          consultant:admin_users!consultant_id(user_profiles(name)),
          enrollment:enrollments!enrollment_id(id, programs(name))
        )
      `
      )
      .eq("event_type", "consultation")
      .eq("consultation_event_data.student_id", studentId)
      .is("deleted_at", null)
      .order("start_at", { ascending: false });

    if (error) {
      logActionError(ACTION_CTX, error, {
        context: "일정 목록 조회",
        studentId,
      });
      return [];
    }

    // calendar_events + consultation_event_data → ConsultationSchedule 뷰모델 매핑
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data as any[]) ?? []).map((row) => {
      // consultation_event_data는 1:1이므로 배열의 첫 번째 또는 단일 객체
      const ced = Array.isArray(row.consultation_event_data)
        ? row.consultation_event_data[0]
        : row.consultation_event_data;

      if (!ced) return null;

      const consultantJoin = ced.consultant as { user_profiles: { name: string | null } | null } | null;
      const consultant = { name: consultantJoin?.user_profiles?.name ?? null };

      // program_name: DB 컬럼 우선, 없으면 enrollment JOIN fallback
      let programName = ced.program_name as string | null;
      if (!programName && ced.enrollment) {
        const enr = ced.enrollment as {
          id: string;
          programs: { name: string } | { name: string }[] | null;
        };
        if (enr.programs) {
          programName = Array.isArray(enr.programs)
            ? enr.programs[0]?.name ?? null
            : enr.programs.name ?? null;
        }
      }

      // timestamptz → scheduled_date / start_time / end_time 추출
      const scheduledDate = extractDateYMD(row.start_at) ?? "";
      const startTime = extractTimeHHMM(row.start_at) ?? "";
      const endTime = extractTimeHHMM(row.end_at) ?? "";
      const durationMinutes = calculateDuration(startTime, endTime);

      return {
        id: row.id,
        tenant_id: row.tenant_id,
        student_id: ced.student_id,
        consultant_id: ced.consultant_id,
        session_type: ced.session_type,
        enrollment_id: ced.enrollment_id,
        program_name: programName,
        scheduled_date: scheduledDate,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes > 0 ? durationMinutes : null,
        consultation_mode: ced.consultation_mode as ConsultationMode,
        meeting_link: ced.meeting_link,
        visitor: ced.visitor,
        location: row.location,
        description: row.description,
        notification_targets: ced.notification_targets ?? ["mother"],
        notification_sent: ced.notification_sent ?? false,
        notification_sent_at: ced.notification_sent_at,
        reminder_sent: ced.reminder_sent ?? false,
        reminder_sent_at: ced.reminder_sent_at,
        status: ced.schedule_status as ConsultationSchedule["status"],
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        consultant_name: consultant?.name ?? undefined,
      } as ConsultationSchedule;
    }).filter(Boolean) as ConsultationSchedule[];
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
  scheduleId: string; // = calendar_events.id (eventId)
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
    const eventId = input.scheduleId;

    // 기존 일정 조회 (변경 감지용)
    const { data: existingEvent } = await supabase
      .from("calendar_events")
      .select("start_at, end_at, location")
      .eq("id", eventId)
      .single();

    const { data: existingConsult } = await supabase
      .from("consultation_event_data")
      .select("consultation_mode, meeting_link, session_type")
      .eq("event_id", eventId)
      .single();

    const durationMinutes = calculateDuration(input.startTime, input.endTime);

    if (durationMinutes <= 0) {
      return { success: false, error: "종료 시간은 시작 시간 이후여야 합니다." };
    }

    // 컨설턴트 일정 충돌 감지 (자기 자신 제외)
    const startAt = toTimestamptz(input.scheduledDate, input.startTime);
    const endAt = toTimestamptz(input.scheduledDate, input.endTime);

    const { data: conflicts } = await supabase
      .from("consultation_event_data")
      .select("event_id, calendar_events!inner(id, start_at, end_at, status, deleted_at)")
      .eq("consultant_id", input.consultantId)
      .neq("event_id", eventId)
      .neq("calendar_events.status", "cancelled")
      .is("calendar_events.deleted_at", null)
      .lt("calendar_events.start_at", endAt)
      .gt("calendar_events.end_at", startAt);

    if (conflicts && conflicts.length > 0) {
      return {
        success: false,
        error: "해당 시간에 이미 예약된 상담이 있습니다.",
      };
    }

    // 학생명 조회 (제목 업데이트용)
    const { data: studentProfile } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", input.studentId)
      .maybeSingle();

    const title = `${input.sessionType} - ${studentProfile?.name ?? "학생"}`;

    // 1. calendar_events UPDATE
    const { error: eventUpdateError } = await supabase
      .from("calendar_events")
      .update({
        title,
        description: input.description ?? null,
        location: input.location ?? null,
        event_subtype: input.sessionType,
        label: input.sessionType,
        start_at: startAt,
        end_at: endAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    if (eventUpdateError) {
      logActionError(ACTION_CTX, eventUpdateError, {
        context: "calendar_events 수정",
        eventId,
      });
      return { success: false, error: "상담 일정 수정에 실패했습니다." };
    }

    // 2. consultation_event_data UPDATE
    const { error: consultUpdateError } = await supabase
      .from("consultation_event_data")
      .update({
        consultant_id: input.consultantId,
        session_type: input.sessionType,
        enrollment_id: input.enrollmentId || null,
        program_name: input.programName || null,
        consultation_mode: input.consultationMode || "대면",
        meeting_link: input.meetingLink || null,
        visitor: input.visitor || null,
        notification_targets: input.notificationTargets ?? ["mother"],
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);

    if (consultUpdateError) {
      logActionError(ACTION_CTX, consultUpdateError, {
        context: "consultation_event_data 수정",
        eventId,
      });
      return { success: false, error: "상담 일정 수정에 실패했습니다." };
    }

    // 날짜/시간/장소가 변경된 경우에만 변경 알림 발송
    if (input.sendNotification !== false && existingEvent && existingConsult) {
      const oldDate = extractDateYMD(existingEvent.start_at) ?? "";
      const oldStartTime = extractTimeHHMM(existingEvent.start_at) ?? "";
      const oldEndTime = extractTimeHHMM(existingEvent.end_at) ?? "";

      const changed =
        oldDate !== input.scheduledDate ||
        oldStartTime !== input.startTime ||
        oldEndTime !== input.endTime ||
        (existingEvent.location ?? "") !== (input.location ?? "") ||
        (existingConsult.consultation_mode ?? "대면") !== (input.consultationMode ?? "대면") ||
        (existingConsult.meeting_link ?? "") !== (input.meetingLink ?? "");

      if (changed) {
        const mode = input.consultationMode ?? "대면";
        const changedTemplateType: SMSTemplateType =
          mode === "원격" ? "consultation_changed_remote" : "consultation_changed";

        await sendChangeNotification({
          templateType: changedTemplateType,
          eventId,
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
    import("@/lib/domains/googleCalendar/enqueue").then(({ enqueueGoogleCalendarSync }) =>
      enqueueGoogleCalendarSync({
        eventId: input.scheduleId,
        tenantId: tenantContext.tenantId!,
        consultantId: input.consultantId,
        action: "update",
      })
    );

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

// ── 상담 일정 삭제 (soft delete via calendar_events.deleted_at) ──

export async function deleteConsultationSchedule(input: {
  scheduleId: string; // = calendar_events.id (eventId)
  studentId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    if (!tenantContext?.tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const supabase = await createSupabaseServerClient();
    const eventId = input.scheduleId;

    // 존재 확인 + consultant_id 조회
    const { data: existing } = await supabase
      .from("calendar_events")
      .select("id, consultation_event_data(consultant_id)")
      .eq("id", eventId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!existing) {
      return { success: false, error: "일정을 찾을 수 없습니다." };
    }

    // Google Calendar 이벤트 취소 (fire-and-forget)
    const consultantId = (existing as Record<string, unknown> & { consultation_event_data?: { consultant_id?: string } })
      .consultation_event_data?.consultant_id;
    if (consultantId) {
      import("@/lib/domains/googleCalendar/enqueue").then(({ enqueueGoogleCalendarSync }) =>
        enqueueGoogleCalendarSync({
          eventId,
          tenantId: tenantContext.tenantId!,
          consultantId,
          action: "cancel",
        })
      );
    }

    // Soft delete (calendar_events.deleted_at 설정)
    const { error: deleteError } = await supabase
      .from("calendar_events")
      .update({
        deleted_at: new Date().toISOString(),
        status: "cancelled",
      })
      .eq("id", eventId);

    if (deleteError) {
      logActionError(ACTION_CTX, deleteError, {
        context: "일정 삭제",
        eventId,
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
  scheduleId: string, // = calendar_events.id (eventId)
  status: "completed" | "cancelled" | "no_show" | "scheduled",
  studentId: string,
  sendNotification?: boolean,
  notificationChannel?: NotificationChannel
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrConsultant();

    const tenantContext = await getTenantContext();
    const supabase = await createSupabaseServerClient();
    const eventId = scheduleId;

    // 취소 시 알림 발송을 위해 일정 정보 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existingConsult: any = null;
    if (status === "cancelled" && tenantContext?.tenantId) {
      const { data } = await supabase
        .from("consultation_event_data")
        .select(
          "consultant_id, session_type, program_name, notification_targets, schedule_status"
        )
        .eq("event_id", eventId)
        .maybeSingle();
      existingConsult = data;

      // 기존 시간 정보도 필요
      const { data: eventData } = await supabase
        .from("calendar_events")
        .select("start_at, end_at")
        .eq("id", eventId)
        .maybeSingle();

      if (eventData && existingConsult) {
        existingConsult.scheduled_date = extractDateYMD(eventData.start_at);
        existingConsult.start_time = extractTimeHHMM(eventData.start_at);
        existingConsult.end_time = extractTimeHHMM(eventData.end_at);
      }
    }

    // consultation_event_data.schedule_status 업데이트
    const { error: consultError } = await supabase
      .from("consultation_event_data")
      .update({
        schedule_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);

    if (consultError) {
      logActionError(ACTION_CTX, consultError, {
        context: "상태 변경",
        eventId,
        status,
      });
      return { success: false, error: "상태 변경에 실패했습니다." };
    }

    // 취소 시 calendar_events.status도 'cancelled'로 변경
    if (status === "cancelled") {
      await supabase
        .from("calendar_events")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventId);
    }

    // 예정으로 되돌릴 때 calendar_events.status를 'confirmed'로 복원
    if (status === "scheduled") {
      await supabase
        .from("calendar_events")
        .update({
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventId);
    }

    // 취소 시 알림 발송
    if (
      status === "cancelled" &&
      sendNotification &&
      tenantContext?.tenantId &&
      existingConsult
    ) {
      try {
        await sendChangeNotification({
          templateType: "consultation_cancelled",
          eventId,
          tenantId: tenantContext.tenantId,
          studentId,
          consultantId: existingConsult.consultant_id,
          sessionType: existingConsult.session_type,
          programName: existingConsult.program_name,
          scheduledDate: existingConsult.scheduled_date,
          startTime: existingConsult.start_time,
          endTime: existingConsult.end_time,
          notificationTargets: existingConsult.notification_targets as
            | NotificationTarget[]
            | undefined,
          notificationChannel,
        });
      } catch (notifyError) {
        logActionError(ACTION_CTX, notifyError, {
          context: "취소 알림 발송 실패 (상태 변경은 완료됨)",
          eventId,
        });
      }
    }

    // 취소 시 Google Calendar 이벤트 취소
    if (status === "cancelled" && tenantContext?.tenantId && existingConsult) {
      const { enqueueGoogleCalendarSync } = await import(
        "@/lib/domains/googleCalendar/enqueue"
      );
      void enqueueGoogleCalendarSync({
        eventId,
        tenantId: tenantContext.tenantId,
        consultantId: existingConsult.consultant_id,
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
  eventId: string;
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
        .from("user_profiles")
        .select("name")
        .eq("id", params.consultantId)
        .maybeSingle(),
    ]);

    const tenant = tenantResult.data as TenantExtended | null;
    const consultant = consultantResult.data;

    const scheduleFormatted = formatScheduleDateTime(
      params.scheduledDate,
      params.startTime,
      params.endTime,
      params.durationMinutes
    );

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
          consultationScheduleId: params.eventId,
          templateVariables,
          variableOrder: alimtalkTemplate.variableOrder,
          notificationTarget: targetLabel,
        });
        sent = result.success;
      }

      if (!sent) {
        const smsResult = await sendSMS({
          recipientPhone,
          message,
          subject: "상담 일정 안내",
          recipientId: params.studentId,
          tenantId: params.tenantId,
          consultationScheduleId: params.eventId,
          notificationTarget: targetLabel,
        });
        sent = smsResult.success;
      }

      if (sent) anySent = true;

      logActionDebug(ACTION_CTX, "알림 발송 결과", {
        eventId: params.eventId,
        sent,
        channel,
        recipientPhone,
        targetLabel,
      });
    }

    // notification_sent 업데이트 (consultation_event_data)
    if (anySent) {
      await adminClient
        .from("consultation_event_data")
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq("event_id", params.eventId);
    }
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "sendScheduleNotification",
      eventId: params.eventId,
    });
  }
}

// ── 내부: 변경/취소 알림 발송 ──

async function sendChangeNotification(params: {
  templateType: SMSTemplateType;
  eventId: string;
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
      adminClient.from("user_profiles").select("name").eq("id", params.consultantId).maybeSingle(),
      adminClient.from("user_profiles").select("name").eq("id", params.studentId).maybeSingle(),
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

    const lmsSubject = params.templateType.includes("cancelled") ? "상담 취소 안내" : "상담 변경 안내";

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
          consultationScheduleId: params.eventId,
          templateVariables,
          variableOrder: alimtalkTemplate.variableOrder,
          notificationTarget: targetLabel,
        });
        sent = result.success;
      }

      if (!sent) {
        const smsResult = await sendSMS({
          recipientPhone,
          message,
          subject: lmsSubject,
          recipientId: params.studentId,
          tenantId: params.tenantId,
          consultationScheduleId: params.eventId,
          notificationTarget: targetLabel,
        });
        sent = smsResult.success;
      }

      logActionDebug(ACTION_CTX, `${params.templateType} 알림 발송`, {
        eventId: params.eventId,
        sent,
        channel,
        recipientPhone,
        targetLabel,
      });
    }
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "sendChangeNotification",
      eventId: params.eventId,
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
  const start = startTime.slice(0, 5);
  const end = endTime.slice(0, 5);
  const base = `${month}/${day}(${weekday}) ${start}~${end}`;
  return durationMinutes ? `${base} (${durationMinutes}분)` : base;
}
