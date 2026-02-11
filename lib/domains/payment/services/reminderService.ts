import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/services/smsService";
import { getPreDueMessage, getOverdueMessage } from "../sms/templates";

type ReminderResult = {
  preDueSent: number;
  overdueSent: number;
  errors: string[];
};

/**
 * 결제 알림 서비스
 * - 납부기한 3일 전: 사전 알림
 * - 납부기한 3/7/14일 후: 독촉 알림
 * - 중복 발송 방지: reminder_sent_at JSONB 체크
 */
export async function processPaymentReminders(): Promise<ReminderResult> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    throw new Error("Admin client 초기화 실패");
  }

  const result: ReminderResult = { preDueSent: 0, overdueSent: 0, errors: [] };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  // D-3 사전 알림 대상
  const preDueDate = new Date(today);
  preDueDate.setDate(preDueDate.getDate() + 3);
  const preDueDateStr = preDueDate.toISOString().slice(0, 10);

  const { data: preDuePayments } = await adminClient
    .from("payment_records")
    .select(
      "id, student_id, amount, paid_amount, due_date, billing_period, reminder_sent_at, tenant_id, students(name), enrollments(programs(name))"
    )
    .eq("due_date", preDueDateStr)
    .in("status", ["unpaid"])
    .limit(100);

  for (const payment of preDuePayments ?? []) {
    const reminderSentAt = (payment.reminder_sent_at as Record<string, string> | null) ?? {};
    if (reminderSentAt.pre_due) continue; // 이미 발송됨

    const student = payment.students as { name: string } | null;
    const enrollment = payment.enrollments as {
      programs: { name: string } | null;
    } | null;

    if (!student) continue;

    // 학생의 연락처 조회 (본인 또는 학부모)
    const phone = await getStudentContactPhone(
      adminClient,
      payment.student_id
    );
    if (!phone) continue;

    const message = getPreDueMessage({
      studentName: student.name,
      programName:
        (enrollment?.programs as { name: string } | null)?.name ?? "프로그램",
      amount: payment.amount - payment.paid_amount,
      dueDate: preDueDateStr,
    });

    try {
      await sendSMS({
        recipientPhone: phone,
        message,
        recipientId: payment.student_id,
        tenantId: payment.tenant_id,
      });

      // reminder_sent_at 업데이트
      await adminClient
        .from("payment_records")
        .update({
          reminder_sent_at: { ...reminderSentAt, pre_due: todayStr },
        })
        .eq("id", payment.id);

      result.preDueSent++;
    } catch (err) {
      result.errors.push(
        `Pre-due SMS failed for payment ${payment.id}: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  // 연체 독촉 (D+3, D+7, D+14)
  const overdueOffsets = [3, 7, 14];

  for (const offset of overdueOffsets) {
    const overdueDate = new Date(today);
    overdueDate.setDate(overdueDate.getDate() - offset);
    const overdueDateStr = overdueDate.toISOString().slice(0, 10);
    const reminderKey = `overdue_${offset}`;

    const { data: overduePayments } = await adminClient
      .from("payment_records")
      .select(
        "id, student_id, amount, paid_amount, due_date, reminder_sent_at, tenant_id, students(name)"
      )
      .eq("due_date", overdueDateStr)
      .in("status", ["unpaid", "partial"])
      .limit(100);

    for (const payment of overduePayments ?? []) {
      const reminderSentAt =
        (payment.reminder_sent_at as Record<string, string> | null) ?? {};
      if (reminderSentAt[reminderKey]) continue;

      const student = payment.students as { name: string } | null;
      if (!student) continue;

      const phone = await getStudentContactPhone(
        adminClient,
        payment.student_id
      );
      if (!phone) continue;

      const message = getOverdueMessage({
        studentName: student.name,
        amount: payment.amount - payment.paid_amount,
        daysPastDue: offset,
      });

      try {
        await sendSMS({
          recipientPhone: phone,
          message,
          recipientId: payment.student_id,
          tenantId: payment.tenant_id,
        });

        await adminClient
          .from("payment_records")
          .update({
            reminder_sent_at: { ...reminderSentAt, [reminderKey]: todayStr },
          })
          .eq("id", payment.id);

        result.overdueSent++;
      } catch (err) {
        result.errors.push(
          `Overdue SMS (D+${offset}) failed for payment ${payment.id}: ${err instanceof Error ? err.message : "unknown"}`
        );
      }
    }
  }

  return result;
}

/** 학생 연락처 조회 (본인 phone → 학부모 mother_phone) */
async function getStudentContactPhone(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  studentId: string
): Promise<string | null> {
  const { data: profile } = await adminClient
    .from("student_profiles")
    .select("phone, mother_phone, father_phone")
    .eq("id", studentId)
    .maybeSingle();

  if (!profile) return null;

  return profile.phone || profile.mother_phone || profile.father_phone || null;
}
