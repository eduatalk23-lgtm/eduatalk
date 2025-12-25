/**
 * Admin Audit Log Module
 *
 * 관리자 작업을 추적하여 문제 원인 파악 및 보안 감사에 활용합니다.
 *
 * @example
 * // 간편 헬퍼 사용
 * import { auditSuccess, auditFailure } from "@/lib/audit";
 *
 * await auditSuccess("create", "student", studentId, {
 *   resourceName: studentName,
 *   newData: { name: studentName, email },
 * });
 *
 * await auditFailure("delete", "camp_template", "권한이 없습니다.", templateId);
 *
 * @example
 * // 상세 로그 기록
 * import { recordAuditLogWithUser } from "@/lib/audit";
 *
 * await recordAuditLogWithUser({
 *   action: "update",
 *   resourceType: "plan_group",
 *   resourceId: planGroupId,
 *   resourceName: planGroupName,
 *   oldData: oldPlanGroup,
 *   newData: newPlanGroup,
 *   metadata: { reason: "일정 변경 요청" },
 * });
 */

export {
  recordAuditLog,
  recordAuditLogWithUser,
  auditSuccess,
  auditFailure,
  getAuditLogs,
  type AuditAction,
  type AuditResourceType,
  type AuditActorRole,
  type AuditLogEntry,
} from "./record";
