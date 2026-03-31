// ============================================
// 에이전트 팝아웃 페이지 (별도 브라우저 창)
// 바텀시트에서 window.open()으로 열림
// BroadcastChannel로 메인 윈도우 UI 상태 수신
// ============================================

import { listStudentsByTenant } from "@/lib/data/students";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { AgentPopoutClient } from "./_components/AgentPopoutClient";

export default async function AgentPopoutPage() {
  // 인증은 layout.tsx에서 처리
  const tenantCtx = await getTenantContext();
  const rawStudents = await listStudentsByTenant(tenantCtx?.tenantId ?? null);
  const students = (rawStudents ?? []).map((s) => ({
    id: s.id,
    name: s.name ?? "이름 없음",
  }));

  return (
    <div className="flex flex-col h-dvh">
      <AgentPopoutClient students={students} />
    </div>
  );
}
