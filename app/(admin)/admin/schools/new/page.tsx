import { SchoolForm } from "./SchoolForm";
import { getRegions } from "@/lib/data/schools";

export default async function NewSchoolPage() {
  const regions = await getRegions();

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">학교 등록</h1>
          <p className="text-sm text-gray-500">
            새로운 학교 정보를 등록하세요.
          </p>
        </div>

        <SchoolForm regions={regions.map((r) => ({ id: r.id, name: r.name }))} />
      </div>
    </section>
  );
}

