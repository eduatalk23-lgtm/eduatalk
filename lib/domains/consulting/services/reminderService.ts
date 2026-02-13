/**
 * 상담 일정 D-1 리마인더 발송 서비스
 * Cron Job에서 호출 (사용자 세션 없음 → Admin Client 사용)
 */

import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { logActionError, logActionDebug } from "@/lib/logging/actionLogger";
import { formatSMSTemplate, type SMSTemplateType } from "@/lib/services/smsTemplates";
import { getAlimtalkTemplate } from "@/lib/services/alimtalkTemplates";
import { sendAlimtalk } from "@/lib/services/alimtalkService";
import { sendSMS } from "@/lib/services/smsService";
import type { NotificationTarget } from "../types";

const ACTION_CTX = { domain: "consulting", action: "reminder" };

type TenantExtended = {
  id: string;
  name: string | null;
  address?: string | null;
  representative_phone?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScheduleRow = Record<string, any>;

/**
 * D-1 리마인더 발송 처리
 * 내일 예정된 상담 일정 중 reminder_sent = false 인 건에 대해 리마인더 발송
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

    // 내일 날짜 (KST 기준)
    const tomorrow = getTomorrowDateKST();

    logActionDebug(ACTION_CTX, "리마인더 처리 시작", { targetDate: tomorrow });

    // 내일 예정된 상담 일정 중 reminder_sent = false, status = scheduled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: schedules, error: queryError } = await (adminClient as any)
      .from("consultation_schedules")
      .select(`
        *,
        student:students!student_id(id, name),
        consultant:admin_users!consultant_id(name),
        enrollment:enrollments!enrollment_id(id, programs(name))
      `)
      .eq("scheduled_date", tomorrow)
      .eq("status", "scheduled")
      .eq("reminder_sent", false);

    if (queryError) {
      logActionError(ACTION_CTX, queryError, { context: "리마인더 대상 조회" });
      return { ...result, success: false, error: "리마인더 대상 조회 실패" };
    }

    const rows = (schedules as ScheduleRow[] | null) ?? [];
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

    // 일정별 리마인더 발송
    for (const row of rows) {
      const studentId = row.student_id as string;
      const phoneData = phoneMap.get(studentId);

      if (!phoneData) {
        logActionDebug(ACTION_CTX, "전화번호 정보 없음, 건너뜀", { studentId });
        result.skipped++;
        continue;
      }

      const targets = (row.notification_targets as NotificationTarget[] | null) ?? ["mother"];
      const phones = resolveTargetPhones(phoneData, targets);

      if (phones.length === 0) {
        logActionDebug(ACTION_CTX, "알림 대상 전화번호 없음, 건너뜀", { studentId, targets });
        result.skipped++;
        continue;
      }

      let anySuccess = false;

      for (const recipientPhone of phones) {
        const sent = await sendReminderNotification({
          scheduleId: row.id as string,
          tenantId: row.tenant_id as string,
          studentName: row.student?.name ?? "",
          consultantName: row.consultant?.name ?? "",
          sessionType: row.session_type as string,
          programName: extractProgramName(row.enrollment),
          scheduledDate: row.scheduled_date as string,
          startTime: row.start_time as string,
          endTime: row.end_time as string,
          consultationMode: (row.consultation_mode as string | null) ?? "대면",
          meetingLink: row.meeting_link as string | null,
          visitor: row.visitor as string | null,
          location: row.location as string | null,
          tenant: tenantMap.get(row.tenant_id as string) ?? null,
          recipientPhone,
          studentId,
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
        // reminder_sent 업데이트
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminClient as any)
          .from("consultation_schedules")
          .update({
            reminder_sent: true,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", row.id);
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
  scheduleId: string;
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
      const result = await sendAlimtalk({
        recipientPhone: params.recipientPhone,
        message,
        tenantId: params.tenantId,
        templateCode: alimtalkTemplate.templateCode,
        recipientId: params.studentId,
        consultationScheduleId: params.scheduleId,
      });
      sent = result.success;
    }

    // 알림톡 미사용 또는 실패 시 SMS fallback
    if (!sent) {
      const smsResult = await sendSMS({
        recipientPhone: params.recipientPhone,
        message,
        recipientId: params.studentId,
        tenantId: params.tenantId,
        consultationScheduleId: params.scheduleId,
      });
      sent = smsResult.success;
    }

    return sent;
  } catch (error) {
    logActionError(ACTION_CTX, error, {
      context: "sendReminderNotification",
      scheduleId: params.scheduleId,
    });
    return false;
  }
}

/**
 * 테넌트 정보 일괄 조회
 */
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

/**
 * 학생별 전화번호 일괄 조회
 * student_profiles 에서 phone, mother_phone, father_phone 조회
 */
async function fetchStudentPhoneMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  studentIds: string[]
): Promise<Map<string, StudentPhoneEntry>> {
  const map = new Map<string, StudentPhoneEntry>();

  if (studentIds.length === 0) return map;

  const { data, error } = await client
    .from("student_profiles")
    .select("id, phone, mother_phone, father_phone")
    .in("id", studentIds);

  if (error) {
    logActionError(ACTION_CTX, error, { context: "학생 전화번호 일괄 조회" });
    return map;
  }

  for (const row of (data ?? []) as Array<{
    id: string;
    phone: string | null;
    mother_phone: string | null;
    father_phone: string | null;
  }>) {
    map.set(row.id, {
      phone: row.phone,
      mother_phone: row.mother_phone,
      father_phone: row.father_phone,
    });
  }
  return map;
}

function resolveTargetPhones(
  phones: StudentPhoneEntry,
  targets: NotificationTarget[]
): string[] {
  const result: string[] = [];
  for (const target of targets) {
    const phone =
      target === "student" ? phones.phone :
      target === "mother" ? phones.mother_phone :
      target === "father" ? phones.father_phone : null;
    if (phone && !result.includes(phone)) result.push(phone);
  }
  return result;
}

/**
 * enrollment JOIN 결과에서 프로그램명 추출
 */
function extractProgramName(enrollment: unknown): string | undefined {
  if (!enrollment || typeof enrollment !== "object") return undefined;
  const e = enrollment as {
    programs?: { name: string } | { name: string }[] | null;
  };
  if (!e.programs) return undefined;
  return Array.isArray(e.programs) ? e.programs[0]?.name : e.programs.name;
}

/**
 * 내일 날짜 (KST 기준) "YYYY-MM-DD" 형식
 */
function getTomorrowDateKST(): string {
  // 서버 TZ에 무관하게 KST 기준으로 "내일" 계산
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
  endTime: string
): string {
  const d = new Date(date + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = weekdays[d.getDay()];
  const start = startTime.slice(0, 5);
  const end = endTime.slice(0, 5);
  return `${month}/${day}(${weekday}) ${start}~${end}`;
}
