import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { CampTemplateForm } from "./CampTemplateForm";

export default async function NewCampTemplatePage() {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  // 템플릿 모드이므로 빈 배열 전달 (학생별 블록 세트 불필요)
  const initialBlockSets: Array<{ id: string; name: string; blocks: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }> }> = [];

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">캠프 템플릿 생성</h1>
          <p className="text-sm text-gray-500">
            새로운 캠프 프로그램 템플릿을 생성하세요.
          </p>
        </div>

        <CampTemplateForm initialBlockSets={initialBlockSets} />
      </div>
    </section>
  );
}

