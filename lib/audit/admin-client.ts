/**
 * Audited Admin Client
 *
 * `createSupabaseAdminClient()`를 감싸 Service Role 사용 사실을 audit_logs에 기록합니다.
 * - RLS 우회는 강력한 권한이므로, 사용 시점·이유·호출자를 추적해 사후 감사를 가능하게 합니다.
 * - 기존 `createSupabaseAdminClient()` 호출은 그대로 유지됩니다(영향 없음).
 *   신규 코드 또는 민감한 PII 접근 지점부터 점진 도입하세요.
 *
 * @example
 *   const admin = await createAuditedAdminClient({
 *     reason: "학부모-자녀 연결 검증",
 *     resourceType: "parent_student_link",
 *     resourceId: linkId,
 *   });
 *   if (!admin) throw new Error("Service role unavailable");
 *   const { data } = await admin.from("parent_student_links").select(...);
 */

import {
  createSupabaseAdminClient,
  type SupabaseAdminClient,
} from "@/lib/supabase/admin";
import { recordAuditLogWithUser } from "./record";
import type { AuditResourceType } from "./record";

export type AdminAccessScope = {
  /** RLS 우회가 필요한 이유 (사후 감사용) */
  reason: string;
  /** 접근 대상 리소스 타입 */
  resourceType: AuditResourceType | string;
  /** 접근 대상 리소스 ID (있는 경우) */
  resourceId?: string | null;
  /** 추가 메타데이터 */
  metadata?: Record<string, unknown>;
};

/**
 * 감사 로그가 부착된 Admin 클라이언트 반환.
 *
 * 사용 사실은 비동기로 기록되며 메인 동작에 영향을 주지 않습니다.
 * actor 정보가 없거나(스크립트/cron) audit 기록이 실패해도 클라이언트 자체는 정상 반환됩니다.
 */
export async function createAuditedAdminClient(
  scope: AdminAccessScope
): Promise<SupabaseAdminClient | null> {
  const client = createSupabaseAdminClient();
  if (!client) return null;

  recordAuditLogWithUser({
    action: "permission_change",
    resourceType: scope.resourceType,
    resourceId: scope.resourceId ?? null,
    metadata: {
      kind: "service_role_access",
      reason: scope.reason,
      ...(scope.metadata ?? {}),
    },
    success: true,
  }).catch(() => {
    // 감사 실패는 호출자에 영향 X
  });

  return client;
}
