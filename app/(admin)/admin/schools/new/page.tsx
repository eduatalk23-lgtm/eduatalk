import { SchoolForm } from "./SchoolForm";

export default function NewSchoolPage() {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">학교 등록</h1>
          <p className="text-sm text-gray-500">
            새로운 학교 정보를 등록하세요.
          </p>
        </div>

        <SchoolForm />
      </div>
    </section>
  );
}

