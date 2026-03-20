// ============================================
// 관리자 Agent 독립 페이지
// 학생 선택 → 전폭 AgentChat
// ============================================

import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { PageHeader } from "@/components/layout/PageHeader";
import { listStudentsByTenant } from "@/lib/data/students";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { AgentPageClient } from "./AgentPageClient";

export default async function AdminAgentPage() {
  const { role } = await getCachedUserRole();
  if (!isAdminRole(role)) redirect("/");

  const tenantCtx = await getTenantContext();
  const rawStudents = await listStudentsByTenant(tenantCtx?.tenantId ?? null);
  const students = (rawStudents ?? []).map((s) => ({
    id: s.id,
    name: s.name ?? "이름 없음",
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <PageHeader title="AI 어시스턴트" />
      <div className="flex-1 overflow-hidden">
        <AgentPageClient students={students} />
      </div>
    </div>
  );
}
