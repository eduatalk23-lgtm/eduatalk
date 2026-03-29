// ============================================
// 에이전트 팝아웃 페이지 (별도 브라우저 창)
// 바텀시트/사이드패널에서 window.open()으로 열림
// BroadcastChannel로 메인 윈도우 UI 상태 수신
// ============================================

import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { listStudentsByTenant } from "@/lib/data/students";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { AgentPopoutClient } from "./_components/AgentPopoutClient";

export default async function AgentPopoutPage() {
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
      <AgentPopoutClient students={students} />
    </div>
  );
}
