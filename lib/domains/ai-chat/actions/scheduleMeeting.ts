"use server";

/**
 * Phase E-1 Sprint 2.2: Chat Shell HITL 일정(면담·상담·행사) 등록 서버 액션.
 *
 * 선례: `applyCreatePlan` (E-1 S-2.1) + consulting `createConsultationSchedule`.
 *
 * 호출 경로:
 *  Chat Shell `scheduleMeeting` tool (execute-less)
 *   → LLM 호출 → state='input-available' → InlineConfirm
 *   → 사용자 승인 → 이 서버 액션 → addToolResult 로 resume.
 *
 * 주요 가드:
 *  1. Zod 재검증 (`scheduleMeetingInputSchema`)
 *  2. `getCurrentUser()` 로 세션 확인
 *  3. admin/consultant/superadmin 재검증 (Layer 2)
 *  4. studentId 분기 — 학생 tenant 확인 + superadmin cross-tenant 분기
 *  5. 과거 시각 금지 (startAt 이 현재 기준 1분 전보다 이전이면 거부)
 *  6. calendar_id 해석: studentId 있으면 학생 primary, 없으면 관리자 primary
 *  7. 같은 calendar_id 내 시간 겹침 충돌 감지 (soft warning — event 삽입 이전 차단)
 *  8. calendar_events INSERT → audit log → Google 동기화 graceful enqueue
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminLikeRole } from "@/lib/mcp/tools/_shared/roleFilter";
import { recordAuditLog, type AuditActorRole } from "@/lib/audit";
import {
  ensureStudentPrimaryCalendar,
  ensureAdminPrimaryCalendar,
} from "@/lib/domains/calendar/helpers";
import {
  scheduleMeetingInputSchema,
  type ScheduleMeetingInput,
  type ApplyScheduleMeetingOutput,
} from "@/lib/mcp/tools/scheduleMeeting";

function toAuditActorRole(role: string | null | undefined): AuditActorRole {
  if (role === "superadmin") return "superadmin";
  if (role === "consultant") return "consultant";
  return "admin";
}

export async function applyScheduleMeeting(
  input: ScheduleMeetingInput,
): Promise<ApplyScheduleMeetingOutput> {
  const parsed = scheduleMeetingInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: `입력 형식 오류: ${parsed.error.issues[0]?.message ?? "유효하지 않습니다."}`,
    };
  }
  const validated = parsed.data;

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "로그인이 필요합니다." };

  if (!isAdminLikeRole(user.role)) {
    return {
      ok: false,
      reason: "일정 등록은 관리자·컨설턴트만 가능합니다.",
    };
  }

  // 과거 시각 방지 — 1분 버퍼(클럭 skew 수용).
  const startMs = Date.parse(validated.startAt);
  if (startMs < Date.now() - 60_000) {
    return { ok: false, reason: "과거 시각에는 일정을 등록할 수 없습니다." };
  }

  const supabase = await createSupabaseServerClient();

  // ─────────────────────────────────────────────────────────
  // tenant·calendar 해석
  //  - studentId 있음 → 학생 primary calendar (학생 tenant 사용)
  //  - studentId 없음 → 관리자 primary calendar (user.tenantId 필요)
  // ─────────────────────────────────────────────────────────
  let tenantId: string;
  let calendarId: string;
  let resolvedStudentId: string | null = null;
  let calendarScope: "student" | "admin";

  if (validated.studentId) {
    const studentRes = await supabase
      .from("students")
      .select("id, tenant_id")
      .eq("id", validated.studentId)
      .maybeSingle();
    if (studentRes.error || !studentRes.data) {
      return {
        ok: false,
        reason: "학생을 찾을 수 없거나 접근 권한이 없습니다.",
      };
    }
    const studentTenantId = studentRes.data.tenant_id;

    if (user.role !== "superadmin") {
      if (!user.tenantId || user.tenantId !== studentTenantId) {
        return {
          ok: false,
          reason: "학생을 찾을 수 없거나 접근 권한이 없습니다.",
        };
      }
    }

    tenantId = studentTenantId;
    resolvedStudentId = validated.studentId;
    try {
      calendarId = await ensureStudentPrimaryCalendar(
        validated.studentId,
        tenantId,
      );
    } catch (err) {
      return {
        ok: false,
        reason: `학생 캘린더 확보 실패: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      };
    }
    calendarScope = "student";
  } else {
    // studentId 없음 → 관리자 개인 캘린더. superadmin 은 tenantId null 이라
    // 이 경로가 막히므로, cross-tenant 의 학원 행사는 studentId 를 전달해야 함.
    if (!user.tenantId) {
      return {
        ok: false,
        reason:
          "학생 미지정 일정은 본인 tenant 관리자만 등록할 수 있습니다. 학생 대상 일정이면 studentId 를 전달하세요.",
      };
    }
    tenantId = user.tenantId;
    try {
      calendarId = await ensureAdminPrimaryCalendar(user.userId, tenantId);
    } catch (err) {
      return {
        ok: false,
        reason: `관리자 캘린더 확보 실패: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      };
    }
    calendarScope = "admin";
  }

  // ─────────────────────────────────────────────────────────
  // 충돌 감지 — 같은 calendar_id 에서 startAt < end AND endAt > start
  // 삭제(deleted_at null) 되지 않고 status != cancelled 인 이벤트만.
  // ─────────────────────────────────────────────────────────
  const conflictRes = await supabase
    .from("calendar_events")
    .select("id")
    .eq("calendar_id", calendarId)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .lt("start_at", validated.endAt)
    .gt("end_at", validated.startAt)
    .limit(1);
  if (conflictRes.error) {
    return {
      ok: false,
      reason: `일정 충돌 확인 실패: ${conflictRes.error.message}`,
    };
  }
  if ((conflictRes.data ?? []).length > 0) {
    return {
      ok: false,
      reason: "같은 시간대에 이미 등록된 일정이 있습니다.",
    };
  }

  // ─────────────────────────────────────────────────────────
  // calendar_events INSERT
  // ─────────────────────────────────────────────────────────
  const creatorRole: "admin" | "student" =
    user.role === "student" ? "student" : "admin";
  const insertRes = await supabase
    .from("calendar_events")
    .insert({
      calendar_id: calendarId,
      tenant_id: tenantId,
      student_id: resolvedStudentId ?? user.userId, // NOT NULL 제약 대비 — 학생 없으면 생성자 id
      title: validated.title,
      description: validated.description ?? null,
      location: validated.location ?? null,
      event_type: "custom",
      event_subtype: "면담",
      label: "면담",
      is_task: false,
      is_exclusion: false,
      start_at: validated.startAt,
      end_at: validated.endAt,
      timezone: "Asia/Seoul",
      is_all_day: false,
      status: "confirmed",
      transparency: "opaque",
      source: "ai-chat-hitl",
      created_by: user.userId,
      creator_role: creatorRole,
    })
    .select("id")
    .single();
  if (insertRes.error || !insertRes.data) {
    return {
      ok: false,
      reason: `일정 등록 실패: ${insertRes.error?.message ?? "unknown"}`,
    };
  }
  const eventId = insertRes.data.id;

  // ─────────────────────────────────────────────────────────
  // Google Calendar 동기화 (graceful, fire-and-forget)
  //   - 학생 이벤트에만 동기화 (관리자 개인 캘린더는 로컬 유지)
  //   - enqueueGoogleCalendarSync 는 OAuth 미연동 시 내부에서 skip.
  // ─────────────────────────────────────────────────────────
  let syncedToGoogle = false;
  if ((validated.syncGoogle ?? true) && resolvedStudentId) {
    try {
      const { enqueueGoogleCalendarSync } = await import(
        "@/lib/domains/googleCalendar/enqueue"
      );
      void enqueueGoogleCalendarSync({
        eventId,
        tenantId,
        consultantId: user.userId,
        action: "create",
      });
      syncedToGoogle = true;
    } catch {
      // 동기화 모듈 로딩 실패도 graceful.
      syncedToGoogle = false;
    }
  }

  // audit
  void recordAuditLog({
    tenantId,
    actorId: user.userId,
    actorRole: toAuditActorRole(user.role),
    actorEmail: user.email ?? null,
    action: "create",
    resourceType: "calendar_event",
    resourceId: eventId,
    oldData: {},
    newData: {
      title: validated.title,
      startAt: validated.startAt,
      endAt: validated.endAt,
      studentId: resolvedStudentId,
      calendarScope,
      syncedToGoogle,
    },
    metadata: { via: "ai-chat-hitl", tool: "scheduleMeeting" },
  });

  if (resolvedStudentId) {
    revalidatePath(`/admin/students/${resolvedStudentId}`);
  }
  revalidatePath("/admin/calendar");

  return {
    ok: true,
    eventId,
    calendarScope,
    syncedToGoogle,
    studentId: resolvedStudentId,
  };
}
