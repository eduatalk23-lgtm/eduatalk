import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SchoolEditForm } from "./SchoolEditForm";

export default async function EditSchoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: school, error } = await supabase
    .from("schools")
    .select("id, name, type, region, address")
    .eq("id", id)
    .maybeSingle();

  if (error || !school) {
    console.error("[admin/schools/edit] 학교 조회 실패:", error);
    redirect("/admin/schools");
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">학교 수정</h1>
          <p className="text-sm text-gray-500">학교 정보를 수정하세요.</p>
        </div>

        <SchoolEditForm school={school} />
      </div>
    </section>
  );
}

