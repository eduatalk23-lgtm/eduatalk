import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/services/smsService";
import { getExpiryWarningMessage } from "@/lib/domains/payment/sms/templates";

type ExpiryResult = {
  notificationsSent: number;
  autoCompleted: number;
  errors: string[];
};

/**
 * 수강 만료 추적 서비스
 * - D-30, D-7, D-1 알림 발송
 * - auto_end_on_expiry = true인 만료 건 자동 완료 처리
 */
export async function processEnrollmentExpiry(): Promise<ExpiryResult> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("Admin client 초기화 실패");
  }

  const result: ExpiryResult = {
    notificationsSent: 0,
    autoCompleted: 0,
    errors: [],
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  // 알림 대상: D-30, D-7, D-1
  const notificationOffsets = [
    { days: 30, key: "d30" },
    { days: 7, key: "d7" },
    { days: 1, key: "d1" },
  ];

  for (const { days, key } of notificationOffsets) {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + days);
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    const { data: enrollments } = await adminClient
      .from("enrollments")
      .select(
        "id, student_id, tenant_id, end_date, expiry_notified_at, students(user_profiles(name)), programs(name)"
      )
      .eq("status", "active")
      .eq("end_date", targetDateStr)
      .limit(200);

    for (const enrollment of enrollments ?? []) {
      const notifiedAt =
        (enrollment.expiry_notified_at as Record<string, string> | null) ?? {};
      if (notifiedAt[key]) continue; // 이미 알림 발송됨

      const studentRaw = enrollment.students as unknown;
      const sObj = Array.isArray(studentRaw) ? studentRaw[0] : studentRaw;
      const sUp = (sObj as Record<string, unknown> | null)?.user_profiles;
      const sUpObj = Array.isArray(sUp) ? sUp[0] : sUp;
      const studentName = (sUpObj as Record<string, unknown> | null)?.name as string | null;
      const program = enrollment.programs as { name: string } | null;
      if (!studentName) continue;

      // 연락처 조회 — phone은 user_profiles, 학부모 phone은 parent_student_links
      const { getStudentPhones } = await import("@/lib/utils/studentPhoneUtils");
      const phoneData = await getStudentPhones(enrollment.student_id);

      const phone =
        phoneData?.phone || phoneData?.mother_phone || phoneData?.father_phone;
      if (!phone) continue;

      const message = getExpiryWarningMessage({
        studentName,
        programName: program?.name ?? "프로그램",
        daysUntilExpiry: days,
      });

      try {
        await sendSMS({
          recipientPhone: phone,
          message,
          recipientId: enrollment.student_id,
          tenantId: enrollment.tenant_id,
        });

        // expiry_notified_at 업데이트
        await adminClient
          .from("enrollments")
          .update({
            expiry_notified_at: { ...notifiedAt, [key]: todayStr },
          })
          .eq("id", enrollment.id);

        result.notificationsSent++;
      } catch (err) {
        result.errors.push(
          `Expiry SMS (D-${days}) failed for enrollment ${enrollment.id}: ${err instanceof Error ? err.message : "unknown"}`
        );
      }
    }
  }

  // 만료된 수강 자동 완료 처리 (auto_end_on_expiry = true)
  const { data: expiredEnrollments } = await adminClient
    .from("enrollments")
    .select("id")
    .eq("status", "active")
    .eq("auto_end_on_expiry", true)
    .lt("end_date", todayStr)
    .limit(200);

  for (const enrollment of expiredEnrollments ?? []) {
    try {
      await adminClient
        .from("enrollments")
        .update({ status: "completed" })
        .eq("id", enrollment.id);

      result.autoCompleted++;
    } catch (err) {
      result.errors.push(
        `Auto-complete failed for enrollment ${enrollment.id}: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  return result;
}
