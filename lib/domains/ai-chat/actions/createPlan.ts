"use server";

/**
 * Phase E-1 Sprint 2.1: Chat Shell HITL 신규 수강 계획 생성.
 *
 * applyArtifactEdit(type=plan) 과 역할 구분:
 *  - applyArtifactEdit = 기존 row 편집 (row.id 필수, plan_status·priority·slot 변경)
 *  - applyCreatePlan = **신규 row INSERT** (id 없음, subjectId/grade/semester 로 생성)
 *
 * 호출 경로:
 *  Chat Shell `createPlan` tool (execute-less)
 *   → LLM 호출 → state='input-available' → InlineConfirm
 *   → 사용자 승인 → 이 서버 액션 → addToolResult 로 resume.
 */

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminLikeRole } from "@/lib/mcp/tools/_shared/roleFilter";
import { recordAuditLog, type AuditActorRole } from "@/lib/audit";
import {
  createPlanInputSchema,
  type CreatePlanInput,
  type ApplyCreatePlanOutput,
} from "@/lib/mcp/tools/createPlan";

function toAuditActorRole(role: string | null | undefined): AuditActorRole {
  if (role === "superadmin") return "superadmin";
  if (role === "consultant") return "consultant";
  return "admin";
}

export async function applyCreatePlan(
  input: CreatePlanInput,
): Promise<ApplyCreatePlanOutput> {
  const parsed = createPlanInputSchema.safeParse(input);
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
      reason: "수강 계획 생성은 관리자·컨설턴트만 가능합니다.",
    };
  }

  const supabase = await createSupabaseServerClient();

  // 학생 조회 — 1차 검증: 존재 + tenant 확인.
  // superadmin 은 cross-tenant 가능 — 학생의 tenant_id 를 그대로 사용.
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

  // admin/consultant 는 본인 tenant 의 학생만. superadmin 은 통과 (tenantId=null).
  if (user.role !== "superadmin") {
    if (!user.tenantId || user.tenantId !== studentTenantId) {
      return {
        ok: false,
        reason: "학생을 찾을 수 없거나 접근 권한이 없습니다.",
      };
    }
  }

  // 기존 동일 slot (student·subject·grade·semester) 조회 → UNIQUE 충돌 skip.
  const slots = validated.courses.map((c) => ({
    subjectId: c.subjectId,
    grade: c.grade,
    semester: c.semester,
  }));
  const subjectIds = [...new Set(slots.map((s) => s.subjectId))];

  const existingRes = await supabase
    .from("student_course_plans")
    .select("subject_id, grade, semester")
    .eq("tenant_id", studentTenantId)
    .eq("student_id", validated.studentId)
    .in("subject_id", subjectIds);
  if (existingRes.error) {
    return {
      ok: false,
      reason: `기존 계획 조회 실패: ${existingRes.error.message}`,
    };
  }

  const existingKey = new Set(
    (existingRes.data ?? []).map(
      (r) => `${r.subject_id}|${r.grade}|${r.semester}`,
    ),
  );

  type InsertRow = {
    tenant_id: string;
    student_id: string;
    subject_id: string;
    grade: number;
    semester: number;
    plan_status: "recommended";
    source: "consultant";
    priority: number;
    notes: string | null;
  };

  const rowsToInsert: InsertRow[] = [];
  let skippedCount = 0;
  for (const c of validated.courses) {
    const key = `${c.subjectId}|${c.grade}|${c.semester}`;
    if (existingKey.has(key)) {
      skippedCount += 1;
      continue;
    }
    // 같은 요청 내 중복도 제거.
    existingKey.add(key);
    rowsToInsert.push({
      tenant_id: studentTenantId,
      student_id: validated.studentId,
      subject_id: c.subjectId,
      grade: c.grade,
      semester: c.semester,
      plan_status: "recommended",
      source: "consultant",
      priority: c.priority ?? 0,
      notes: c.notes ?? null,
    });
  }

  if (rowsToInsert.length === 0) {
    return {
      ok: false,
      reason:
        skippedCount > 0
          ? `모든 항목(${skippedCount}건)이 이미 등록된 학기·과목입니다.`
          : "생성할 수강 계획이 없습니다.",
    };
  }

  const insertRes = await supabase
    .from("student_course_plans")
    .insert(rowsToInsert)
    .select("id");
  if (insertRes.error) {
    return {
      ok: false,
      reason: `수강 계획 생성 실패: ${insertRes.error.message}`,
    };
  }
  const createdCount = insertRes.data?.length ?? 0;

  // audit — admin-like 경로만 기록.
  void recordAuditLog({
    tenantId: studentTenantId,
    actorId: user.userId,
    actorRole: toAuditActorRole(user.role),
    actorEmail: user.email ?? null,
    action: "create",
    resourceType: "course_plan",
    resourceId: validated.studentId,
    oldData: {},
    newData: {
      createdCount,
      skippedCount,
      courses: rowsToInsert.map((r) => ({
        subject_id: r.subject_id,
        grade: r.grade,
        semester: r.semester,
      })),
    },
    metadata: { via: "ai-chat-hitl", tool: "createPlan" },
  });

  revalidatePath(`/admin/students/${validated.studentId}`);
  revalidatePath(`/admin/students/${validated.studentId}/plans`);

  return {
    ok: true,
    createdCount,
    skippedCount,
    studentId: validated.studentId,
  };
}
