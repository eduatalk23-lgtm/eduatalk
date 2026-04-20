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
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
        <span className="font-medium">디버그·추적 전용 페이지</span> · 실사용은{" "}
        <a
          href="/ai-chat"
          className="underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100"
        >
          /ai-chat
        </a>
        에서 동일한 도구(심층 분석·수강 계획·입시 분석 포함)를 이용하세요. 이 화면은
        step trace·도구 입력/출력을 확인하기 위한 운영용 뷰입니다.
      </div>
      <div className="flex-1 overflow-hidden">
        <AgentPageClient students={students} />
      </div>
    </div>
  );
}
