import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getSlotTemplatePresets } from "@/lib/domains/camp/actions";
import { PresetList } from "./_components/PresetList";

export default async function SlotPresetsPage() {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const result = await getSlotTemplatePresets();
  const presets = result.success ? result.presets : [];

  return (
    <div className="flex flex-col gap-8 p-6 md:p-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <a href="/admin/camp-templates" className="hover:text-indigo-600">
            캠프 템플릿
          </a>
          <span>/</span>
          <span>슬롯 프리셋</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">슬롯 프리셋 관리</h1>
        <p className="text-sm text-gray-600">
          자주 사용하는 슬롯 구성을 프리셋으로 저장하고 관리합니다.
        </p>
      </div>

      <PresetList initialPresets={presets ?? []} />
    </div>
  );
}
