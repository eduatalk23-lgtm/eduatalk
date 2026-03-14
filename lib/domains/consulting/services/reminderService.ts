/**
 * 상담 일정 D-1 리마인더 발송 서비스
 * Cron Job에서 호출 (사용자 세션 없음 → Admin Client 사용)
 *
 * Phase 4: consultation_event_data + calendar_events 기반으로 전환
 */

import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { formatSMSTemplate, type SMSTemplateType } from "@/lib/services/smsTemplates";
import { getAlimtalkTemplate } from "@/lib/services/alimtalkTemplates";
import { sendAlimtalk } from "@/lib/services/alimtalkService";
import { sendSMS } from "@/lib/services/smsService";
import { extractDateYMD, extractTimeHHMM } from "@/lib/domains/calendar/adapters";
import type { NotificationTarget } from "../types";

const ACTION_CTX = { domain: "consulting", action: "reminder" };

type TenantExtended = {
  id: string;
  name: string | null;
  address?: string | null;
  representative_phone?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventRow = Record<string, unknown>;

/**
 * D-1 리마인더 발송 처리
 * 내일 예정된 상담 이벤트 중 reminder_sent = false인 건에 대해 리마인더 발송
 */
export async function processConsultationReminders(): Promise<{
  success: boolean;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  error?: string;
}> {
  const result = { success: true, processed: 0, sent: 0, failed: 0, skipped: 0 };

  try {
    const adminClient = await getSupabaseClientForRLSBypass({
      forceAdmin: true,
      fallbackToServer: false,
    });

    if (!adminClient) {
      return { ...result, success: false, error: "Admin client 초기화 실패" };
    }

    const tomorrow = getTomorrowDateKST();
    const tomorrowStart = `${tomorrow}T00:00:00+09:00`;
    const tomorrowEnd = `${tomorrow}T23:59:59+09:00`;

    logActionDebug(ACTION_CTX, "리마인더 처리 시작", { targetDate: tomorrow });

    // calendar_events + consultation_event_data JOIN으로 내일 예정 상담 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: events, error: queryError } = await (adminClient as any)
      .from("calendar_events")
      .select(`
        id, title, description, start_at, end_at, location, tenant_id, student_id,
        consultation_event_data!inner(
          consultant_id, session_type, program_name,
          consultation_mode, meeting_link, visitor,
          notification_targets, reminder_sent
        ),
        student:students!student_id(id, name),
        consultant:admin_users!consultant_id(name)
      `)
      .eq("event_type", "consultation")
      .gte("start_at", tomorrowStart)
      .lte("start_at", tomorrowEnd)
      .eq("consultation_event_data.schedule_status", "scheduled")
      .eq("consultation_event_data.reminder_sent", false)
      .is("deleted_at", null);

    if (queryError) {
      logActionError(ACTION_CTX, queryError, { context: "리마인더 대상 조회" });
      return { ...result, success: false, error: "리마인더 대상 조회 실패" };
    }

    const rows = (events as EventRow[] | null) ?? [];
    result.processed = rows.length;

    if (rows.length === 0) {
      logActionDebug(ACTION_CTX, "리마인더 대상 없음", { targetDate: tomorrow });
      return result;
    }

    // 테넌트 정보 일괄 조회
    const tenantIds = [...new Set(rows.map((r) => r.tenant_id as string))];
    const tenantMap = await fetchTenantMap(adminClient, tenantIds);

    // 학생별 전화번호 일괄 조회
    const studentIds = [...new Set(rows.map((r) => r.student_id as string))];
    const phoneMap = await fetchStudentPhoneMap(adminClient, studentIds);

    // 이벤트별 리마인더 발송
    for (const row of rows) {
      const studentId = row.student_id as string;
      const phoneData = phoneMap.get(studentId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cd = (row as any).consultation_event_data;

      if (!phoneData) {
        logActionDebug(ACTION_CTX, "전화번호 정보 없음, 건너뜀", { studentId });
        result.skipped++;
        continue;
      }

      const targets = (cd.notification_targets as NotificationTarget[] | null) ?? ["mother"];
      const recipients = resolveTargetPhones(phoneData, targets);

      if (recipients.length === 0) {
        logActionDebug(ACTION_CTX, "알림 대상 전화번호 없음, 건너뜀", { studentId, targets });
        result.skipped++;
        continue;
      }

      let anySuccess = false;

      const scheduledDate = extractDateYMD(row.start_at as string) ?? tomorrow;
      const startTime = extractTimeHHMM(row.start_at as string) ?? "00:00";
      const endTime = extractTimeHHMM(row.end_at as string) ?? "00:00";

      for (const { phone: recipientPhone, targetLabel } of recipients) {
        const sent = await sendReminderNotification({
          eventId: row.id as string,
          tenantId: row.tenant_id as string,
          studentName: (row as EventRow & { student?: { name: string } }).student?.name ?? "",
          consultantName: (row as EventRow & { consultant?: { name: string } }).consultant?.name ?? "",
          sessionType: cd.session_type as string,
          programName: cd.program_name as string | undefined,
          scheduledDate,
          startTime,
          endTime,
          consultationMode: (cd.consultation_mode as string | null) ?? "대면",
          meetingLink: cd.meeting_link as string | null,
          visitor: cd.visitor as string | null,
          location: row.location as string | null,
          tenant: tenantMap.get(row.tenant_id as string) ?? null,
          recipientPhone,
          studentId,
          notificationTarget: targetLabel,
        });

        if (sent) {
          anySuccess = true;
          result.sent++;
        } else {
          result.failed++;
        }

        // Rate limit 방지 (100ms 딜레이)
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (anySuccess) {
        // consultation_event_data.reminder_sent 업데이트
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminClient as any)
          .from("consultation_event_data")
          .update({
            reminder_sent: true,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq("event_id", row.id);
      }
    }

    logActionDebug(ACTION_CTX, "리마인더 처리 완료", result);
    return result;
  } catch (error) {
    logActionError(ACTION_CTX, error, { context: "processConsultationReminders" });
    return { ...result, success: false, error: "리마인더 처리 중 오류 발생" };
  }
}

// ── 내부 함수 ──

async function sendReminderNotification(params: {
  eventId: string;
  tenantId: string;
  studentName: string;
  consultantName: string;
  sessionType: string;
  programName?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  consultationMode: string;
  meetingLink: string | null;
  visitor: string | null;
  location: string | null;
  tenant: TenantExtended | null;
  recipientPhone: string;
  studentId: string;
  notificationTarget?: string;
}): Promise<boolean> {
  try {
    const scheduleFormatted = formatScheduleDateTime(
      params.scheduledDate,
      params.startTime,
      params.endTime
    );

    const consultationType = params.programName || params.sessionType;

    const isRemote = params.consultationMode === "원격";
    const smsTemplateType: SMSTemplateType = isRemote
      ? "consultation_reminder_remote"
      : "consultation_reminder";

    const templateVariables: Record<string, string> = {
      학원명: params.tenant?.name ?? "",
      학생명: params.studentName,
      상담유형: consultationType,
      컨설턴트명: params.consultantName,
      방문상담자: params.visitor || "학생 & 학부모",
      상담일정: scheduleFormatted,
      ...(isRemote
        ? { 참가링크: params.meetingLink || "" }
        : { 상담장소: params.location || params.tenant?.address || "" }),
      대표번호: params.tenant?.representative_phone || "",
    };

    const message = formatSMSTemplate(smsTemplateType, templateVariables);

    // 알림톡 우선, 실패 시 SMS
    const alimtalkTemplate = getAlimtalkTemplate(smsTemplateType);

    let sent = false;

    if (alimtalkTemplate) {
      const alimResult = await sendAlimtalk({
        recipientPhone: params.recipientPhone,
        message,
        smsFallbackMessage: message,
        smsFallbackSubject: "상담 리마인더",
        tenantId: params.tenantId,
        templateCode: alimtalkTemplate.templateCode,
        recipientId: params.studentId,
        consultationScheduleId: params.eventId,
        templateVariables,
        variableOrder: alimtalkTemplate.variableOrder,
        notificationTarget: params.notificationTarget,
      });
      sent = alimResult.success;
    }

    // 알림톡 미사용 또는 실패 시 SMS fallback
    if (!sent) {
      const smsResult = await sendSMS({
        recipientPhone: params.recipientPhone,
        message,
        subject: "상담 리마인더",
        recipientId: params.studentId,
        tenantId: params.tenantId,
        consultationScheduleId: params.eventId,
        notificationTarget: params.notificationTarget,
      });
      sent = smsResult.success;
    }

    return sent;
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "sendReminderNotification",
      eventId: params.eventId,
    });
    return false;
  }
}

async function fetchTenantMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  tenantIds: string[]
): Promise<Map<string, TenantExtended>> {
  const map = new Map<string, TenantExtended>();
  if (tenantIds.length === 0) return map;

  const { data, error } = await client
    .from("tenants")
    .select("*")
    .in("id", tenantIds);

  if (error) {
    logActionError(ACTION_CTX, error, { context: "테넌트 일괄 조회" });
    return map;
  }

  for (const row of (data ?? []) as TenantExtended[]) {
    map.set(row.id, row);
  }
  return map;
}

type StudentPhoneEntry = {
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
};

async function fetchStudentPhoneMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _client: any,
  studentIds: string[]
): Promise<Map<string, StudentPhoneEntry>> {
  const map = new Map<string, StudentPhoneEntry>();
  if (studentIds.length === 0) return map;

  // parent_student_links → user_profiles 기반 조회 (getStudentPhonesBatch 사용)
  try {
    const { getStudentPhonesBatch } = await import("@/lib/utils/studentPhoneUtils");
    const phoneDataList = await getStudentPhonesBatch(studentIds);

    for (const p of phoneDataList) {
      map.set(p.id, {
        phone: p.phone,
        mother_phone: p.mother_phone,
        father_phone: p.father_phone,
      });
    }
  } catch (error) {
    logActionError(ACTION_CTX, error, { context: "학생 전화번호 일괄 조회" });
  }

  return map;
}

const TARGET_LABELS: Record<NotificationTarget, string> = {
  student: "학생",
  mother: "모",
  father: "부",
};

function resolveTargetPhones(
  phones: StudentPhoneEntry,
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

function getTomorrowDateKST(): string {
  const kstNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  kstNow.setDate(kstNow.getDate() + 1);
  const year = kstNow.getFullYear();
  const month = String(kstNow.getMonth() + 1).padStart(2, "0");
  const day = String(kstNow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
