export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getAllTemplateBlockSets } from "@/app/(admin)/actions/templateBlockSets";
import TemplateBlockSetManagement from "./_components/TemplateBlockSetManagement";

export default async function TimeManagementPage() {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">기관 정보를 찾을 수 없습니다.</p>
        </div>
      </section>
    );
  }

  // 템플릿에 연결되지 않은 블록 세트 목록 조회
  let blockSets: Array<{
    id: string;
    name: string;
    template_id: string | null;
    blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
  }> = [];

  try {
    blockSets = await getAllTemplateBlockSets();
  } catch (error) {
    console.error("블록 세트 조회 실패:", error);
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">시간 블록 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          블록 세트를 생성하고 관리할 수 있습니다. 템플릿을 생성하지 않아도 시간 블록을 생성할 수 있습니다.
        </p>
      </div>

      <TemplateBlockSetManagement
        initialBlockSets={blockSets}
      />
    </section>
  );
}

