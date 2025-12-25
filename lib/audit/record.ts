/**
 * Admin Audit Log Recording
 *
 * 관리자 작업을 추적하여 문제 원인 파악 및 보안 감사에 활용합니다.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "bulk_create"
  | "bulk_update"
  | "bulk_delete"
  | "login"
  | "logout"
  | "permission_change"
  | "status_change"
  | "export"
  | "import";

export type AuditResourceType =
  | "student"
  | "camp_template"
  | "camp_invitation"
  | "plan_group"
  | "plan"
  | "block_set"
  | "block"
  | "attendance"
  | "score"
  | "admin_user"
  | "tenant"
  | "permission"
  | "scheduler_settings"
  | "sms"
  | "master_content"
  | "master_lecture";

export type AuditActorRole = "superadmin" | "admin" | "consultant";

export type AuditLogEntry = {
  tenantId?: string | null;
  actorId: string;
  actorRole: AuditActorRole;
  actorEmail?: string | null;
  action: AuditAction;
  resourceType: AuditResourceType | string;
  resourceId?: string | null;
  resourceName?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string | null;
};

/**
 * 감사 로그 기록
 *
 * 메인 기능에 영향을 주지 않도록 에러를 삼킵니다.
 * Admin 클라이언트를 사용하여 RLS를 우회합니다.
 */
export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const adminClient = createSupabaseAdminClient();
    if (!adminClient) {
      console.warn("[audit] Admin 클라이언트를 사용할 수 없습니다.");
      return;
    }

    const payload = {
      tenant_id: entry.tenantId,
      actor_id: entry.actorId,
      actor_role: entry.actorRole,
      actor_email: entry.actorEmail,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      resource_name: entry.resourceName,
      old_data: entry.oldData,
      new_data: entry.newData,
      metadata: entry.metadata || {},
      success: entry.success ?? true,
      error_message: entry.errorMessage,
    };

    const { error } = await adminClient.from("audit_logs").insert(payload);

    if (error) {
      console.error("[audit] 감사 로그 기록 실패:", {
        message: error.message,
        code: error.code,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
      });
    }
  } catch (error) {
    // 감사 로그 기록 실패는 메인 기능에 영향 주지 않음
    console.error("[audit] 감사 로그 기록 중 예외 발생:", {
      message: error instanceof Error ? error.message : String(error),
      action: entry.action,
      resourceType: entry.resourceType,
    });
  }
}

/**
 * 현재 사용자 정보로 감사 로그 기록 헬퍼
 *
 * Server Action에서 편리하게 사용할 수 있습니다.
 */
export async function recordAuditLogWithUser(
  entry: Omit<AuditLogEntry, "actorId" | "actorRole" | "actorEmail" | "tenantId"> & {
    actorId?: string;
    actorRole?: AuditActorRole;
    actorEmail?: string | null;
    tenantId?: string | null;
  }
): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn("[audit] 사용자 정보를 가져올 수 없습니다.");
      return;
    }

    // 사용자 역할 및 테넌트 정보 조회
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("role, tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!adminUser) {
      console.warn("[audit] 관리자 정보를 찾을 수 없습니다.");
      return;
    }

    await recordAuditLog({
      ...entry,
      tenantId: entry.tenantId ?? adminUser.tenant_id,
      actorId: entry.actorId ?? user.id,
      actorRole: (entry.actorRole ?? adminUser.role) as AuditActorRole,
      actorEmail: entry.actorEmail ?? user.email,
    });
  } catch (error) {
    console.error("[audit] 사용자 정보 조회 중 예외 발생:", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 성공한 작업의 감사 로그 기록 (간편 헬퍼)
 */
export async function auditSuccess(
  action: AuditAction,
  resourceType: AuditResourceType | string,
  resourceId?: string | null,
  options?: {
    resourceName?: string | null;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await recordAuditLogWithUser({
    action,
    resourceType,
    resourceId,
    resourceName: options?.resourceName,
    oldData: options?.oldData,
    newData: options?.newData,
    metadata: options?.metadata,
    success: true,
  });
}

/**
 * 실패한 작업의 감사 로그 기록 (간편 헬퍼)
 */
export async function auditFailure(
  action: AuditAction,
  resourceType: AuditResourceType | string,
  errorMessage: string,
  resourceId?: string | null,
  options?: {
    resourceName?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await recordAuditLogWithUser({
    action,
    resourceType,
    resourceId,
    resourceName: options?.resourceName,
    metadata: options?.metadata,
    success: false,
    errorMessage,
  });
}

/**
 * 감사 로그 조회 (테넌트별)
 */
export async function getAuditLogs(options: {
  tenantId?: string | null;
  limit?: number;
  offset?: number;
  action?: AuditAction;
  resourceType?: AuditResourceType | string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    tenant_id: string | null;
    actor_id: string;
    actor_role: string;
    actor_email: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    resource_name: string | null;
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    metadata: Record<string, unknown>;
    success: boolean;
    error_message: string | null;
    created_at: string;
  }>;
  count?: number;
  error?: string;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (options.tenantId) {
      query = query.eq("tenant_id", options.tenantId);
    }

    if (options.action) {
      query = query.eq("action", options.action);
    }

    if (options.resourceType) {
      query = query.eq("resource_type", options.resourceType);
    }

    if (options.actorId) {
      query = query.eq("actor_id", options.actorId);
    }

    if (options.startDate) {
      query = query.gte("created_at", options.startDate);
    }

    if (options.endDate) {
      query = query.lte("created_at", options.endDate);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [], count: count || 0 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "감사 로그 조회 실패",
    };
  }
}
