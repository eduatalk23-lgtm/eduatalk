export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getCampTemplateById } from "@/app/(admin)/actions/campTemplateActions";
import { getTemplateBlockSets } from "@/app/(admin)/actions/templateBlockSets";
import TemplateBlockSetManagement from "./_components/TemplateBlockSetManagement";
import Link from "next/link";

type TimeManagementPageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function TimeManagementPage({
  params,
}: TimeManagementPageProps) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { templateId } = await params;
  const tenantContext = await getTenantContext();
  
  if (!tenantContext?.tenantId) {
    redirect("/login");
  }

  // 템플릿 조회 및 권한 확인
  const result = await getCampTemplateById(templateId);
  if (!result.success || !result.template) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">템플릿을 찾을 수 없습니다.</p>
        </div>
      </section>
    );
  }

  const template = result.template;

  // 템플릿 블록 세트 목록 조회
  let blockSets: Array<{
    id: string;
    name: string;
    blocks?: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>;
  }> = [];

  try {
    const blockSetsResult = await getTemplateBlockSets(templateId);
    if (blockSetsResult.success && blockSetsResult.data) {
      blockSets = blockSetsResult.data;
    }
  } catch (error) {
    console.error("템플릿 블록 세트 조회 실패:", error);
  }

  // template_data에서 현재 선택된 block_set_id 확인
  const templateData = template.template_data as any;
  const selectedBlockSetId = templateData?.block_set_id || null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 md:py-10">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/admin/time-management"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← 시간 관리 목록
              </Link>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">시간 관리</h1>
            <p className="mt-1 text-sm text-gray-500">
              템플릿: {template.name}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          템플릿에 사용할 블록 세트를 생성하고 관리할 수 있습니다.
        </p>
      </div>

      <TemplateBlockSetManagement
        templateId={templateId}
        initialBlockSets={blockSets}
        selectedBlockSetId={selectedBlockSetId}
      />
    </section>
  );
}

