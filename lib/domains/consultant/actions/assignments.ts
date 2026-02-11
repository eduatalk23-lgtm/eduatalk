"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionError } from "@/lib/logging/actionLogger";
import type {
  ConsultantAssignmentWithDetails,
  CreateAssignmentInput,
  ConsultantRole,
} from "../types";

type ActionResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

/** 학생의 컨설턴트 배정 목록 조회 */
export async function getStudentAssignmentsAction(
  studentId: string
): Promise<ActionResult<ConsultantAssignmentWithDetails[]>> {
  try {
    await requireAdminOrConsultant();

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { data: rawAssignments, error } = await adminClient
      .from("consultant_assignments")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const rows = rawAssignments ?? [];

    // 컨설턴트 이름, 프로그램 이름을 별도 조회
    const consultantIds = [...new Set(rows.map((r) => r.consultant_id))];
    const enrollmentIds = rows
      .map((r) => r.enrollment_id)
      .filter((id): id is string => id !== null);

    const [consultantResult, enrollmentResult] = await Promise.all([
      consultantIds.length > 0
        ? adminClient
            .from("admin_users")
            .select("id, name")
            .in("id", consultantIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      enrollmentIds.length > 0
        ? adminClient
            .from("enrollments")
            .select("id, program_id, programs(name)")
            .in("id", enrollmentIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              programs: { name: string } | null;
            }[],
          }),
    ]);

    const consultantMap = new Map(
      (
        (consultantResult as { data: { id: string; name: string }[] | null })
          .data ?? []
      ).map((c: { id: string; name: string }) => [c.id, c.name])
    );

    const enrollmentMap = new Map(
      (
        (
          enrollmentResult as {
            data: {
              id: string;
              programs: { name: string } | null;
            }[] | null;
          }
        ).data ?? []
      ).map(
        (e: { id: string; programs: { name: string } | null }) =>
          [
            e.id,
            (e.programs as { name: string } | null)?.name ?? null,
          ] as const
      )
    );

    const assignments: ConsultantAssignmentWithDetails[] = rows.map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      student_id: row.student_id,
      enrollment_id: row.enrollment_id,
      consultant_id: row.consultant_id,
      role: row.role as ConsultantRole,
      notes: row.notes,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      consultant_name: consultantMap.get(row.consultant_id) ?? "",
      program_name: row.enrollment_id
        ? enrollmentMap.get(row.enrollment_id) ?? null
        : null,
    }));

    return { success: true, data: assignments };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "배정 조회 중 오류가 발생했습니다.",
    };
  }
}

/** 컨설턴트 배정 생성 */
export async function createConsultantAssignmentAction(
  input: CreateAssignmentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    // 컨설턴트가 같은 테넌트인지 확인
    const { data: consultant } = await adminClient
      .from("admin_users")
      .select("tenant_id")
      .eq("id", input.consultant_id)
      .maybeSingle();

    if (!consultant || consultant.tenant_id !== tenantId) {
      return { success: false, error: "유효하지 않은 컨설턴트입니다." };
    }

    const { data, error } = await adminClient
      .from("consultant_assignments")
      .insert({
        tenant_id: tenantId,
        student_id: input.student_id,
        consultant_id: input.consultant_id,
        enrollment_id: input.enrollment_id ?? null,
        role: input.role ?? "primary",
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: "이미 동일한 배정이 존재합니다." };
      }
      logActionError(
        { domain: "consultant", action: "createAssignment", tenantId, userId },
        error,
        { studentId: input.student_id, consultantId: input.consultant_id }
      );
      return { success: false, error: "배정 등록에 실패했습니다." };
    }

    revalidatePath("/admin/students");
    return { success: true, data: { id: data.id } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "배정 등록 중 오류가 발생했습니다.",
    };
  }
}

/** 컨설턴트 배정 삭제 */
export async function deleteConsultantAssignmentAction(
  assignmentId: string
): Promise<ActionResult> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { data: assignment } = await adminClient
      .from("consultant_assignments")
      .select("tenant_id")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment || assignment.tenant_id !== tenantId) {
      return { success: false, error: "권한이 없습니다." };
    }

    const { error } = await adminClient
      .from("consultant_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      logActionError(
        { domain: "consultant", action: "deleteAssignment", tenantId, userId },
        error,
        { assignmentId }
      );
      return { success: false, error: "배정 삭제에 실패했습니다." };
    }

    revalidatePath("/admin/students");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "배정 삭제 중 오류가 발생했습니다.",
    };
  }
}

/** 내 담당 학생 목록 조회 (컨설턴트 대시보드용) */
export async function getMyAssignedStudentsAction(): Promise<
  ActionResult<
    {
      id: string;
      name: string;
      grade: number | null;
      role: ConsultantRole;
      program_names: string;
      enrollment_count: number;
    }[]
  >
> {
  try {
    const { userId, tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { data: rawAssignments, error } = await adminClient
      .from("consultant_assignments")
      .select("*")
      .eq("consultant_id", userId)
      .eq("tenant_id", tenantId);

    if (error) {
      return { success: false, error: error.message };
    }

    const rows = rawAssignments ?? [];

    // 학생 정보 조회
    const studentIds = [...new Set(rows.map((r) => r.student_id))];
    const enrollmentIds = rows
      .map((r) => r.enrollment_id)
      .filter((id): id is string => id !== null);

    const [studentsResult, enrollmentsResult] = await Promise.all([
      studentIds.length > 0
        ? adminClient
            .from("students")
            .select("id, name, grade")
            .in("id", studentIds)
        : Promise.resolve({
            data: [] as { id: string; name: string; grade: number | null }[],
          }),
      enrollmentIds.length > 0
        ? adminClient
            .from("enrollments")
            .select("id, programs(name)")
            .in("id", enrollmentIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              programs: { name: string } | null;
            }[],
          }),
    ]);

    const studentMap = new Map(
      (
        (
          studentsResult as {
            data: {
              id: string;
              name: string;
              grade: number | null;
            }[] | null;
          }
        ).data ?? []
      ).map(
        (s: { id: string; name: string; grade: number | null }) =>
          [s.id, s] as const
      )
    );

    const enrollmentProgramMap = new Map(
      (
        (
          enrollmentsResult as {
            data: {
              id: string;
              programs: { name: string } | null;
            }[] | null;
          }
        ).data ?? []
      ).map(
        (e: { id: string; programs: { name: string } | null }) =>
          [
            e.id,
            (e.programs as { name: string } | null)?.name ?? null,
          ] as const
      )
    );

    // 학생별로 그룹화
    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        grade: number | null;
        role: ConsultantRole;
        programs: Set<string>;
        count: number;
      }
    >();

    for (const row of rows) {
      const student = studentMap.get(row.student_id);
      if (!student) continue;

      const programName = row.enrollment_id
        ? enrollmentProgramMap.get(row.enrollment_id)
        : null;

      const existing = grouped.get(student.id);
      if (existing) {
        if (programName) existing.programs.add(programName);
        existing.count++;
      } else {
        const programs = new Set<string>();
        if (programName) programs.add(programName);
        grouped.set(student.id, {
          id: student.id,
          name: student.name,
          grade: student.grade,
          role: row.role as ConsultantRole,
          programs,
          count: 1,
        });
      }
    }

    const result = Array.from(grouped.values()).map((s) => ({
      id: s.id,
      name: s.name,
      grade: s.grade,
      role: s.role,
      program_names: Array.from(s.programs).join(", ") || "-",
      enrollment_count: s.count,
    }));

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "담당 학생 조회 중 오류가 발생했습니다.",
    };
  }
}

/** 테넌트 내 컨설턴트 목록 조회 (배정 드롭다운용) */
export async function getConsultantsAction(): Promise<
  ActionResult<{ id: string; name: string; role: string }[]>
> {
  try {
    const { tenantId } = await requireAdminOrConsultant({
      requireTenant: true,
    });

    if (!tenantId) {
      return { success: false, error: "기관 정보를 찾을 수 없습니다." };
    }

    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      return { success: false, error: "Admin client 초기화 실패" };
    }

    const { data, error } = await adminClient
      .from("admin_users")
      .select("id, name, role")
      .eq("tenant_id", tenantId)
      .in("role", ["admin", "consultant"])
      .order("name");

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data ?? [] };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "컨설턴트 목록 조회 중 오류가 발생했습니다.",
    };
  }
}
