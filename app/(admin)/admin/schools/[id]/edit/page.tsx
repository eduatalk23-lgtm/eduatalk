import { redirect } from "next/navigation";
import { SchoolEditForm } from "./SchoolEditForm";
import { getSchoolById, getRegions } from "@/lib/data/schools";

export default async function EditSchoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const school = await getSchoolById(id);

  if (!school) {
    redirect("/admin/schools");
  }

  const regions = await getRegions();

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">학교 수정</h1>
          <p className="text-sm text-gray-500">학교 정보를 수정하세요.</p>
        </div>

        <SchoolEditForm
          school={school}
          regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        />
      </div>
    </section>
  );
}

