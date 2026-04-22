/**
 * Phase G S-2: MCP tool role 기반 필터.
 *
 * Layer 1 가드 — Shell LLM 에 노출되는 tool 목록 자체에서 특정 tool 을 제거.
 * Layer 2 가드는 runSubagent 내부의 allowedRoles 검증이 수행하지만, LLM 이
 * 프롬프트 인젝션으로 tool name 을 추측해 호출을 시도하는 경로를 원천 차단.
 *
 * 현재 admin 전용 tool: analyzeRecordDeep (record-sub), designStudentPlan (plan-sub),
 * analyzeAdmission (admission-sub), getBlueprint, listStudents (Phase E-1 S-1).
 *
 * G-6 Sprint 4 Option A: superadmin 은 admin-like 에 포함. eduatalk 운영사 내부
 * 관리자로서 cross-tenant 조회 가능(tenantId=null). `resolveStudentTarget` 에서
 * 학생 tenant 를 cross-tenant 검색으로 결정 → downstream tool 이 학생 tenant 로
 * 동작. 세부는 `memory/superadmin-option-a-decision.md` 참조.
 */

export type McpUserRole =
  | "student"
  | "admin"
  | "consultant"
  | "superadmin"
  | "parent"
  | null
  | undefined;

export const ADMIN_ONLY_TOOL_NAMES = new Set<string>([
  "analyzeRecordDeep",
  "designStudentPlan",
  "analyzeAdmission",
  "getBlueprint",
  "listStudents",
]);

export function isAdminLikeRole(role: McpUserRole): boolean {
  return role === "admin" || role === "consultant" || role === "superadmin";
}

/**
 * 주어진 tool 딕셔너리에서 role 에 노출 불가한 tool 키를 제거한다.
 * admin-like role 은 전체 통과. student/parent/null 은 admin-only tool 제거.
 */
export function filterToolsForRole<T>(
  tools: Record<string, T>,
  role: McpUserRole,
): Record<string, T> {
  if (isAdminLikeRole(role)) return tools;
  const filtered: Record<string, T> = {};
  for (const [key, value] of Object.entries(tools)) {
    if (!ADMIN_ONLY_TOOL_NAMES.has(key)) filtered[key] = value;
  }
  return filtered;
}
